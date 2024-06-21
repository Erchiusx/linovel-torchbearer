function ExistsNovel( id ) {
	return fetch( `https://www.linovel.net/book/${id}.html`,
	 	{ 
	 		method: "GET" 
	 	}
	).then( _ => _.status );
}

const { readFile } = require("node:fs/promises");
async function main(){
	
	// 轻库的书本编码从100000到140000，具体规律没有摸清，所以全扫一遍

	// 恢复上次扫描的进度
	const last = await readFile( "./bookList", "utf8" ).then( content => content.split( /\n/g ).at(-2) ?? "100000" ).then( line => + line.split( / /g )[0] );

	// 扫描的时候限制频率0.5Hz
	for( let i = last + 1; i < 140000; ++i )
		await Promise.allSettled( [ sleep(0.5), ExistsNovel(i) ] ).then(
            ([ , status ]) => console.log( i, status.value )
        )

}

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, 1000*delay))

main()

