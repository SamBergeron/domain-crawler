#!/usr/bin/env node

var path = require('path'),
    pkg = require(path.join(__dirname, 'package.json')),
    program = require('commander'), // For making command line options
    SiteMapCrawler = require('./sitemapCrawler.js');

program
  .version(pkg.version)
  .usage('[options] <url>')
  .option('-p, --protocol [protocol]', 'Specify the protocol to be used for requests, defaults to http', /^(http|https)$/i, 'http')
  .option('-i, --info', 'Print info on non valid urls (like 404 errors)')
  .option('-t, --timeout <t>', 'Specify the timeout to use for all requests in ms, defaults to 3s')
  .parse(process.argv);

if (!program.args.length) {
  program.help();
} else {
  var url = program.args[0];
  console.log('Start url is: ' + url);
  console.log('Protocol being used is: ' + program.protocol);

  // Make are crawler object and start the search
  crawler = new SiteMapCrawler(url, program.protocol, program.timeout);
  crawler.setInfoLevel(program.info);
  crawler.proccessQueue(crawler.initialUrl);
}
