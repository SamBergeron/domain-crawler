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
  this.retries = 5;

  this.uriList = [];
  this.uriQueue = [];
  this.uriAssetsList = [];
  this.retryList = [];
  this.invalidLinkCount = 0;

  this.domain = new URI(url).domain();
  console.log('Domain crawled is: ' + this.domain);

  // Initialize our listener
  this.printFinalUrlList(outputFile);
};

SiteMapCrawler.prototype.setInfoLevel = function(info) {
  this.info = info;
};

SiteMapCrawler.prototype.setRetries = function(retry) {
  this.retries = retry;
};

SiteMapCrawler.prototype.crawlUrl = function(url) {
  var siteMapCrawler = this;
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

    if(res) {
      // Make sure we have a valid response
      if(res.statusCode >= 200 && res.statusCode < 300) {
        if(body) {
          // We have a valid body parse it's contents for linkAsset
          siteMapCrawler.parseHtmlContent(res, body);
        }
      }
      else if(res.statusCode >= 400) {
        // Some kind of html error
        console.log(chalk.bold.yellow('\nGET returned status code: %s for %s'), res.statusCode, url);
        siteMapCrawler.invalidLinkCount++;
      }
      // We've had our response for this url, it's now done processing
      siteMapCrawler.eventEmitter.emit('urlProccessed', url);
    }

    // Something went wrong with the request
    if(err) {
      // Retry if this was a read error on our part
      // This happens because we're pooling through our connections too fast
      if(err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
        siteMapCrawler.retryLink(url);
      } else {
        // The url actually doesn't work, take it out of the queue
        console.log(chalk.red('\n' + err));
        siteMapCrawler.eventEmitter.emit('urlProccessed', url);
      }
    }
  });
};

SiteMapCrawler.prototype.parseHtmlContent = function(res, body) {
  var siteMapCrawler = this;
  var anchorList = [];
  var imgList = [];
  var $ = cheerio.load(body);  //Let's use JQuery selectors

  // Loop over anchor tags in our body
  $('a').each( function(i, elem) {
    var link = $(elem).attr('href'); // Extract the link

    // Make sure the link exists and is not already in our list
    if(link && anchorList.indexOf(link) === -1) {
      anchorList.push(link);
    }
  });

  // Do the same for all image links
  $('img').each( function(i, elem) {
    var img = $(elem).attr('src');
    // Make sure the link exists and is not already in our list
    if(img && imgList.indexOf(img) === -1) {
      // Keep only images on our own domain
      var imgUri = URI(img);
      if(imgUri.is('relative'))
        imgList.push(img);
    }
  });

  // Get the uri from the origin of the response
  // This is useful if we were redirected
  var requestUri = res.request.uri.href;
  // Call our method to parse the anchors
  siteMapCrawler.updateUrlList(anchorList, requestUri, imgList);

};

SiteMapCrawler.prototype.retryLink = function(url) {
  var siteMapCrawler = this;
  var retryList = siteMapCrawler.retryList;
  var retriedLink = {};
  var isFound = false;

  // Check if we've already retried our url once
  for(var i=0; i < retryList.length; i++){
    // If yes increment retry count
    if(retryList[i].url === url) {
      isFound = true;
      retryList[i].try++;
      retriedLink = retryList[i];
    }
  }

  // If we have exceeded our retry limit, forget about this url
  if(isFound === true && retriedLink.try > siteMapCrawler.retries) {
      console.log(chalk.bold.yellow('\nRetries exceeded for %s'), url);
      siteMapCrawler.eventEmitter.emit('urlProccessed', url);
      return; // Because we don't want to start a new crawl
  } else {
    // Make a retry link
    retriedLink = {
      url: url,
      try: 1
    };

    // Add link to list of retried url
    siteMapCrawler.retryList.push(retriedLink);
  }
  // Retry the crawl
  siteMapCrawler.crawlUrl(url);
};

SiteMapCrawler.prototype.updateUrlList = function(anchorList, originUrl, assetList) {
  var siteMapCrawler = this;
  for(var i=0; i < anchorList.length; i++) {
    // Make new URIs from our anchor list
    var tempUri = URI(anchorList[i]);
    // Remove any trailing query strings
    tempUri = tempUri.search("");
    // Remove any trailing hashes
    tempUri = tempUri.fragment("");

    if(tempUri.is('relative')) { // Ex: Relative would be "/about"
      // Append our relative uri to our main one
      var encodedPath = URI(tempUri.href()).pathname(true);
      tempUri = URI(originUrl).pathname(encodedPath);
    }

    // Normalize the subdomain if not specified
    if(tempUri.subdomain() === '') {
      tempUri = tempUri.subdomain('www');
    }

    // Normalize the protocol
    tempUri = tempUri.protocol(siteMapCrawler.protocol);

    // Remove irregularities in URL (like capital letters)
    tempUri = tempUri.normalize();
    //tempUri = tempUri.encode();

    // Verify we are in the same domain
    if(tempUri.domain() === siteMapCrawler.domain) {
      if(siteMapCrawler.uriList.indexOf(tempUri.href()) === -1) {
        // Then add to our uri list
        siteMapCrawler.uriList.push(tempUri.href());

        // Make a new object we will save for priting later
        var uriAndAssets = {
          url: tempUri.href(),
          assets: assetList
        };
        siteMapCrawler.uriAssetsList.push(uriAndAssets);

        // Add our uris to the queue
        siteMapCrawler.uriQueue.push(tempUri.href());
        siteMapCrawler.crawlUrl(tempUri.href());
      }
    }
  }
  // console.log(siteMapCrawler.uriList); // debug
};

SiteMapCrawler.prototype.proccessQueue = function(startUrl) {
  var siteMapCrawler = this;
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
  var siteMapCrawler = this;

  siteMapCrawler.eventEmitter.on('queueProccessed', function() {
    console.log(chalk.cyan('\nDone!'));
    console.log(chalk.bold.green('The crawler found %s unique urls'), siteMapCrawler.uriList.length);
    console.log(chalk.bold.yellow('%s invalid links were found'), siteMapCrawler.invalidLinkCount);

    var finalList = siteMapCrawler.uriList.sort();
    var outputFile = output || "results.txt";

    // Create the file, crushes old one
    fs.writeFileSync(outputFile, '');
    console.log(chalk.cyan(outputFile + ' has been created'));

    if(outputFile) {
      for(var i=0; i < finalList.length; i++) {
        var link = finalList[i];

        // Find this list in the list with assets and print it
        for (var j=0; j < siteMapCrawler.uriAssetsList.length; j++) {
          if(siteMapCrawler.uriAssetsList[j].url === finalList[i]) {
            fs.appendFileSync(outputFile, link + '\n');

            // Print all of the assets for this link
            var linkAssets = siteMapCrawler.uriAssetsList[j].assets;
            for(var k=0; k < linkAssets.length; k++) {
              fs.appendFileSync(outputFile, '\t' + linkAssets[k] + '\n');
            }

          }
        }
      }
    }

    // We're done here
    process.exit(0);
  });

  // on SIGINT event, print what we found
  process.on('SIGINT', function() {
    siteMapCrawler.eventEmitter.emit('queueProccessed');
  });

};

module.exports = SiteMapCrawler;
