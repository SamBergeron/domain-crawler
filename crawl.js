#!/usr/bin/env node

var path = require('path'),
    pkg = require(path.join(__dirname, 'package.json')),
    program = require('commander'), // For making command line options
    request = require('request'), // For making HTTP requests
    cheerio = require('cheerio'), // For parsing the DOM
    URI = require('URIjs'); // For using URIs as objects

program
  .version(pkg.version)
  .usage('[options] <url>')
  .option('-p, --protocol [protocol]', 'Specify the protocol to be used for requests, defaults to http', /^(http|https)$/i, 'http')
  .option('-i, --info', 'Print info on non valid urls (like 404 errors)')
  .option('-t, --timeout <t>', 'Specify the timeout to use for all requests in ms, defaults to 3s')
  .parse(process.argv);

var SiteMapCrawler = function(url, protocol) {
  this.initialUrl = url;
  this.protocol = protocol;
  this.timeout = program.timeout || 3000; // 3 seconds
  this.uriList = [];

  // Normalize the protocol and removing trailing hashes
  this.initialUri = new URI(url).protocol(protocol).fragment('');
  this.domain = this.initialUri.domain();

  console.log('Domain crawled is: ' + this.domain);

  this.uriList.push(this.initialUri.href());
};

SiteMapCrawler.prototype.crawlUrl = function(url) {
  siteMapCrawler = this;
  var anchorList = [];
  var nextCrawlList = [];
  var options = {
    url: url,
    timeout: siteMapCrawler.timeout
  };

  request(options, function(err, res, body) {
    if (res) {
      if (res.statusCode >= 200 && res.statusCode < 300) { // Make sure we have a valid response
        if (body) {
          var $ = cheerio.load(body);  //Let's use JQuery selectors
          $('a').each( function(i, elem) { // Looking for anchor tags in our body
            var link = $(elem).attr('href'); // Extract the href

            // Make sure the link exists and is not already in our list
            if (link && anchorList.indexOf(link) === -1) {
              anchorList.push(link);
            }
          });
          // Returns the uri of the request, if we were redirected
          var requestUri = res.request.uri.href;
          // Call our method to parse anchors and return build urls
          nextCrawlList = siteMapCrawler.updateUrlList(anchorList, requestUri);

          // If we have new un-crawled urls
          if(nextCrawlList && nextCrawlList.length > 0) {
            for(var i=0; i < nextCrawlList.length; i++) {
              // Parse all the new urls
              siteMapCrawler.crawlUrl(nextCrawlList[i]);
            }
          }
        }
      }
      else if (res.statusCode >= 400) {
        if (program.info) { // If the info option was specified
          console.info('GET returned status code: ' + res.statusCode + ' for ' + url);
        }
      }
    }
    // if (err) {
    //   // Something went wrong with the request
    //   console.log(err);
    //   return;
    // }
  });
};

SiteMapCrawler.prototype.updateUrlList = function(anchorList, originUrl) {
  siteMapCrawler = this;
  var urlsToCrawl = [];
  for(var i=0; i < anchorList.length; i++) {
    // Make new URIs from our anchor list
    var tempUri = URI(anchorList[i]);
    // Remove any trailing query strings
    tempUri = tempUri.search("");
    // Remove any trailing hashes
    tempUri = tempUri.fragment("");

    if (tempUri.is('relative')) {
      // Append our relative uri to our main one
      tempUri = URI(originUrl).pathname(tempUri.href());
    }

    //Normalize the protocol
    tempUri = tempUri.protocol(siteMapCrawler.protocol);

    // Verify we are in the same domain
    if(tempUri.domain() === siteMapCrawler.domain) {
      // Then add to our uri list
      if(siteMapCrawler.uriList.indexOf(tempUri.href()) === -1) {
        siteMapCrawler.uriList.push(tempUri.href());
        // We push all the new urls to a list we will return and recurse on
        urlsToCrawl.push(tempUri.href());
      }
    }
  }
  //console.log(siteMapCrawler.uriList); // debug
  //console.log(urlsToCrawl.length);
  return(urlsToCrawl);
};

SiteMapCrawler.prototype.printFinalUrlList = function() {
  var finalList = this.uriList;
  console.log(finalList.sort());
};

if (!program.args.length) {
  program.help();
} else {
  var url = program.args[0];
  console.log('Start url is: ' + url);
  console.log('Protocol being used is: ' + program.protocol);

  // Make are crawler object and start the search
  crawler = new SiteMapCrawler(url, program.protocol);
  crawler.crawlUrl(crawler.initialUrl);
}
