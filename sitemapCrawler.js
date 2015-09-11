var request = require('request'), // For making HTTP requests
    cheerio = require('cheerio'), // For parsing the DOM
    events = require('events'), // For emitters and listeners
    chalk = require('chalk'), // For coloring cli outputs
    fs = require('fs'), // For writing to file
    URI = require('URIjs'); // For using URIs as objects

var SiteMapCrawler = function(url, protocol, timeout, outputFile) {
  this.eventEmitter = new events.EventEmitter();

  this.initialUrl = url;
  this.protocol = protocol;
  this.timeout = parseInt(timeout) || 3000; // 3 seconds

  this.uriList = [];
  this.uriQueue = [];
  this.invalidLinkCount = 0;

  this.domain = new URI(url).domain();
  console.log('Domain crawled is: ' + this.domain);

  // Initialize our listener
  this.printFinalUrlList(outputFile);
};

SiteMapCrawler.prototype.setInfoLevel = function(info) {
  this.info = info;
};

SiteMapCrawler.prototype.crawlUrl = function(url) {
  siteMapCrawler = this;
  var anchorList = [];
  var options = {
    method: 'GET',
    url: url,
    timeout: siteMapCrawler.timeout,
  };

  // Log what site we are crawling on -i option
  if(siteMapCrawler.info) {
    console.log('Crawling ' + url);
  // Otherwise mark our action (for console visual aid)
  } else { process.stdout.write('.'); }

  var req = request(options, function(err, res, body) {

    if (res) {
      if (res.statusCode >= 200 && res.statusCode < 300) { // Make sure we have a valid response
        if (body) {
          var $ = cheerio.load(body);  //Let's use JQuery selectors
          $('a').each( function(i, elem) { // Loop over anchor tags in our body
            var link = $(elem).attr('href'); // Extract the link

            // Make sure the link exists and is not already in our list
            if (link && anchorList.indexOf(link) === -1) {
              anchorList.push(link);
            }
          });

          // Get the uri from the origin of the response
          // This is useful if we were redirected
          var requestUri = res.request.uri.href;
          // Call our method to parse the anchors
          siteMapCrawler.updateUrlList(anchorList, requestUri);

        }
      }
      else if (res.statusCode >= 400) {
        console.log(chalk.bold.yellow('\nGET returned status code: %s for %s'), res.statusCode, url);
        siteMapCrawler.invalidLinkCount++;
      }
      siteMapCrawler.eventEmitter.emit('urlProccessed', url);
    }
    // Something went wrong with the request
    if (err) {
      // Retry if this was a read error on our part
      // This happens because we're pooling through our connections too fast
      if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
        siteMapCrawler.crawlUrl(url);
      } else {
        // The url actually doesn't work, take it out of the queue
        console.log(chalk.red('\n' + err));
        siteMapCrawler.eventEmitter.emit('urlProccessed', url);
      }
    }
  });
};

SiteMapCrawler.prototype.updateUrlList = function(anchorList, originUrl) {
  siteMapCrawler = this;
  for(var i=0; i < anchorList.length; i++) {
    // Make new URIs from our anchor list
    var tempUri = URI(anchorList[i]);
    // Remove any trailing query strings
    tempUri = tempUri.search("");
    // Remove any trailing hashes
    tempUri = tempUri.fragment("");

    if (tempUri.is('relative')) { // Ex: Relative would be "/about"
      // Append our relative uri to our main one
      tempUri = URI(originUrl).pathname(tempUri.href());
    }

    // Normalize the subdomain if not specified
    if(tempUri.subdomain() === '') {
      tempUri = tempUri.subdomain('www');
    }

    // Normalize the protocol
    tempUri = tempUri.protocol(siteMapCrawler.protocol);

    // Remove irregularities in URL (like capital letters)
    tempUri = tempUri.normalize();

    // Verify we are in the same domain
    if(tempUri.domain() === siteMapCrawler.domain) {
      if(siteMapCrawler.uriList.indexOf(tempUri.href()) === -1) {
        // Then add to our uri list
        siteMapCrawler.uriList.push(tempUri.href());
        // Add our uris to the queue
        siteMapCrawler.uriQueue.push(tempUri.href());
        siteMapCrawler.crawlUrl(tempUri.href());
      }
    }
  }
  // console.log(siteMapCrawler.uriList); // debug
};

SiteMapCrawler.prototype.proccessQueue = function(startUrl) {
  siteMapCrawler = this;
  var queue = siteMapCrawler.uriQueue;
  // Initial run
  siteMapCrawler.crawlUrl(startUrl);

  // Listen for the end of each url crawls
  siteMapCrawler.eventEmitter.on('urlProccessed', function(url) {
    // Start a new crawl with the first element of the queue
    var next = queue.shift();
    if(next) {
      // Still has stuff to do
    } else { // If the queue is empty we're done crawling
      siteMapCrawler.eventEmitter.emit('queueProccessed');
    }
  });

};

SiteMapCrawler.prototype.printFinalUrlList = function(output) {
  siteMapCrawler = this;

  siteMapCrawler.eventEmitter.on('queueProccessed', function() {
    console.log(chalk.cyan('\nDone!'));
    console.log(chalk.bold.green('The crawler found %s unique urls'), siteMapCrawler.uriList.length);
    console.log(chalk.bold.yellow('%s invalid links were found'), siteMapCrawler.invalidLinkCount);

    var finalList = siteMapCrawler.uriList.sort();
    var outputFile = output || "results.txt";

    // Create the file, crushes old one
    fs.writeFileSync(outputFile, '');
    console.log(chalk.cyan(outputFile + ' has been created'));

    for(var i=0; i < finalList.length; i++) {
      var link = URI(finalList[i]);
      if(outputFile) {
        // Save results to file
        fs.appendFileSync(outputFile, link.href() + '\n');
      }
    }

    // We're done here
    process.exit(0);

  });
};

module.exports = SiteMapCrawler;
