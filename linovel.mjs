// sleep for seconds
const sleep = delay => new Promise( resolve => setTimeout( resolve, 1000*delay ) );


import { JSDOM } from "jsdom"; // dom simulator, mainly provides Element.prototype.querySelector*
import { readFileSync } from "node:fs"; // readFileSync to init and recover from exit
import { mkdir, writeFile } from "node:fs/promises"; // mkdir and writeFile as promises to use in async context

class ExpectRetryError extends Error {
	constructor( reason, retries ){
		super( reason );
		this.retries = retries;
	}
}

// set maximum fetch frequency when fetch
function fetchSleep( url, config, retries = 5 ){
    console.log( "fetching", url );
    return Promise.allSettled( [ sleep(0.5), fetch( new URL( url, urlRoot ), config ) ] ).
        then( ([ , response ]) => response ).
        then( ( { value } ) => {
            if( value?.ok )
                return value;
            else
                throw new ExpectRetryError( `fetch url ${url} failed`, retries );
        } )
}

function saveFigureTo( url, path ){
    return fetchSleep( url, { method: "GET" } ).
		then(
			success => success,
			({ retries }) => {
				if( retries > 0 )
					return fetchSleep( url, { method: "GET" }, retries - 1 )
				else
					throw new Error( `fetch figure ${url} failed, expected to save to ${path}` )
			}
		).
		then( _ => _.arrayBuffer() ).
		then( buffer => writeFile( path, Buffer.from( buffer ) ) ).
		catch( reason => console.error( reason ) );
}

const urlRoot = "https://www.linovel.net";
async function getBookInfo( id ){

    let page;
    try {

        // get page HTML
        page = await fetchSleep( `/book/${id}.html#catalog`, { method: "GET" } ).then( _ => _.text() ).then( _ => new JSDOM( _ ) );

        // prepare the dir to save to
        await mkdir( `./books/${id}`, { recursive: true } );

    } catch( error ){
        return;
    }

    // get book cover
    const coverURL = page.window.document.querySelector('div.book-cover a img').src;
    await saveFigureTo( coverURL, `./books/${id}/cover.webp` );

    // get book title and introduction, save to info.json
    const title = page.window.document.querySelector('h1').innerHTML;
    const introduction = page.window.document.querySelector( 'div.about-text.text-content-actual' ).innerHTML;

    const info = { title, introduction };
    writeFile( `./books/${id}/info.json`, JSON.stringify( info, null, "\t" ) );

    // get sections containing links to chapters
    const sectionDivs = [ ... page.window.document.querySelectorAll("div.section-list div.section") ];

    for( let index in sectionDivs ){
        const div = sectionDivs[index];

        // make sectional dir and save section cover figure
        await mkdir( `./books/${id}/${index}`, { recursive: true } );
        await saveFigureTo( div.querySelector( "div.volume-info div.volume-cover a img" ).src, `./books/${id}/${index}/cover.webp` );

        // get info from section div
        const info = {
            title: div.querySelector("div.volume-info h2.volume-title a").innerHTML,
            hint : div.querySelector("div.volume-info div.volume-hint").innerHTML,
            desc : div.querySelector("div.volume-info div.volume-desc div.text-content-actual").innerHTML,
            chaps: [...div.querySelectorAll("div.chapter-list div.chapter a")].map( ({ href, innerHTML }) => ({href, innerHTML}) )
        };

        let imageCount = 0;
        // read chapters
        for( let chapterIndex in info.chaps ){

            // get chapter url and fetch page HTML
            const { href: url } = info.chaps[ chapterIndex ];
            const page = await fetchSleep( url, { method: "GET" } ).then( _ => _.text() ).then( _ => new JSDOM(_), error => error );
            if( page instanceof ExpectRetryError ){
                console.error( page );
                continue;
            }

            // read page basic info and store them globally( in book info.json file rather than in chapter )
            const [ updateTime, wordCount ] = [...page.window.document.querySelectorAll("div.article-info")].map( _ => _.childNodes[2].textContent.trim() )
            info.chaps[chapterIndex].updateTime = updateTime;
            info.chaps[chapterIndex].wordCount = wordCount;

            // every line of the article is in <div.article-text><p.l> element
            // each line may contain imgs or plain text
            const lines = page.window.document.querySelectorAll( "div.article-text p.l" );

            // prepare empty array to contain extracted paragraphs
            const article = [];
            for( let line of lines )
                if( line.classList.contains("l-image") ){ // if there be image for a line
                    // save the figure enumerated, and leave a signal here
                    await saveFigureTo( line.querySelector("img").src, `./books/${id}/${index}/${imageCount}.webp` );
                    article.push( "    " + `![${ [...line.childNodes].find( node => node.nodeType === page.window.Node.TEXT_NODE )?.nodeValue ?? "" }](${imageCount})` );
                    ++imageCount;
                }
                else // for pure text lines, they begin with a tab
                // rather, in lines containing imgs, they begin with four spaces,
                // and the rest part is marked as ![]()
                // inside the bracket is the text behind the figure,
                // while inside the parenthese is the enumerated index for the figure.
                    article.push( "\t" + line.innerHTML )
            writeFile( `./books/${id}/${index}/${chapterIndex}.md`, article.join( "\n" ) );
        }
        writeFile( `./books/${id}/${index}/info.json`, JSON.stringify( info, null, "\t" ) )
    }

}

// recover when exited without completing the full task
const last = +readFileSync( "./last.index", "utf8" );
const books = readFileSync( "./bookList", "utf8" ).
    split( /\n/g ).
    map( _ => +_ ).
    filter( id => id >= last );

for( let book of books )
    await getBookInfo( book );
