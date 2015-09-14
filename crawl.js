#!/usr/bin/env node

var path = require('path'),
    pkg = require(path.join(__dirname, 'package.json')),
    program = require('commander'), // For making command line options
    SiteMapCrawler = require('./sitemapCrawler.js');

program
  .version(pkg.version)
  .usage('[options] <url> <outputFile>')
  .option('-p, --protocol [protocol]', 'Specify the protocol to be used for requests, defaults to http', /^(http|https)$/i, 'http')
  .option('-i, --info', 'Output crawl info to console')
  .option('-t, --timeout <t>', 'Specify the timeout to use for all requests in ms, defaults to 3s')
  .option('-r, --retries <r>', 'Specify the number of times the program retries a failing request, defaults to 5')
  .parse(process.argv);

if (!program.args.length) {
  program.help();
} else {
  var url = program.args[0];
  var outputFile = program.args[1];
  console.log('Start url is: ' + url);
  console.log('Protocol being used is: ' + program.protocol);

  // Make are crawler object and start the search
  crawler = new SiteMapCrawler(url, program.protocol, program.timeout, outputFile);
  crawler.setInfoLevel(program.info);
  crawler.setRetries(program.retries);
  crawler.proccessQueue(crawler.initialUrl);
}
