export interface ParseOptions {
	on_key:		(key:string, value:string, query?:string) => void,
	on_enter:	(key:string) => void,
	on_exit:	() => void,
}

const C_QUOTE  = 34,	// "
      C_BOPEN  = 123,	// {
      C_BCLOSE = 125,	// }
      C_ESCAPE = 92,	// \
	  C_LN     = 10;	// \n

function is_plain( code: number ) {
	return (
		( code > 32 && code < 92 ) ||
		( code > 92 && code < 125 )
	);
}

function is_term( code: number ) {
	return (
		code == 32 || code == 9 || code == C_LN ||
		code == C_BOPEN || code == C_BCLOSE );
}

const TE = new TextEncoder();
export function parse( text:string, options:ParseOptions ) {
	const data			= TE.encode( text );
	let key: string		= null;
	let value: string	= null;

	for ( let i=0; i<data.length; i++ ) {
		const c = data[i];
		const escaped = data[i-1] === C_ESCAPE;

		// Spacing ( tab, space, \r, \n )
		if ( c === 9 || c === 32 || c === 13 || c === C_LN ) continue;

		// Start bracket
		if ( c === C_BOPEN && !escaped ) {
			if ( key === null ) throw( `Attempted to enter block without key at ${i}!` );
			options.on_enter( key );
			key = null;
			continue;
		}

		// End bracket
		if ( c === C_BCLOSE && !escaped ) {
			options.on_exit();
			continue;
		}

		// Quoted string
		if ( c === C_QUOTE && !escaped ) {
			const start = i+1;

			while (true) {
				i = data.indexOf(C_QUOTE, i+1);
				if (i === -1) throw( `Encountered unterminated quote starting at ${start-1}!` );
				if (data[i-1] !== C_ESCAPE) break;
			}

			const chunk = text.slice(start, i);
			if ( key === null )			key = chunk;
			else if ( value === null )	value = chunk;
			else {
				options.on_key( key, value );
				value = null, key = chunk;
			}

			continue;
		}

		// Single-line comment ( // )
		if ( c  === 47 && data[i+1] === 47 ) {
			i = data.indexOf(C_LN, i+1);
			if ( i === -1 ) break;
			continue;
		}

		// Multi-line comment ( /* )
		if ( c === 47 && data[i+1] === 42 ) {
			const start = i;
			while (true) {
				i = data.indexOf(42, i+1);
				if ( i === -1 ) throw( `Encountered unterminated multiline comment starting at ${start}!` );
				if ( data[i+1] === 47 ) break;
			}

			i ++;
			continue;
		}

		// Non-quoted string
		if ( is_plain(c) ) {
			const start = i;

			while (true) {
				i++;
				if ( is_term(data[i]) && data[i-1] !== C_ESCAPE ) break;
			}

			const chunk = text.slice(start, i);
			if ( key === null )			key = chunk;
			else if ( value === null )	value = chunk;
			else {
				if ( data[start] === 91 && data[i-1] === 93 ) {
					options.on_key( key, value, chunk );
					key = null;
				}
				else {
					options.on_key( key, value );
					key = chunk;
				}
				value = null;
			}
		}
	}

	if ( key !== null && value !== null ) options.on_key( key, value );
	else if ( key !== null ) throw( 'Encountered unpaired key!' );
	return;
}