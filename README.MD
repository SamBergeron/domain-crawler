# Site Map crawler
## GoCardless interview project

#### Usage:
- Download files, make sure nodeJS is installed
- run "npm install"
- run "node crawl.js [url] [outputfile]"
- run "node crawl.js --help" for options

#### Where this came from
Earlier this week I recieved directives for a programming challenge from goCardless
> [...]<br>
> We'd like you to write a simple web crawler, in whatever language you're most comfortable in, which given a URL to crawl, should output a site map, showing the static assets for each page.
> [...] <br>
> It should be limited to one domain - so when crawling gocardless.com it would crawl all pages within the gocardless.com domain, but not follow the links to our Facebook and Twitter accounts. We’ll be testing it against gocardless.com. Bonus points for making it as fast as possible!
> [...]

Initially this seemed straight-forward, though I'd never writtent anything ressembling a web crawler, I had a general idea of how one worked. I decided I had a couple of basic things to do for a program to be considered a "web crawler":
 - Pull the content from a web page given a url
 - Parse the content to find links to other urls
 - Repeat for each new url

I decided that JavaScript would be the easiest for me, it's what I've been working with recently, and with NodeJS a quick working solution could be made without too much hassle. JavaScript it was then, afterall it was made for parsing the web anyways.

Normally on assignments like this one, I can ask a bunch of questions to get me started in the right direction, this time I felt a little left to my own interpretations. I decided my idea of "output a site map", would be printing a list of all valid links, ordered alphabetically, and structured so we could see a nice hierarchy. "showing the static assets for each page" was the trickiest part, after a bit of pondering, I figured it would be all endpoints, including clickable images.

### Design
First off, I tried to make this application as simple and as straight-forward as possible. The __SiteMapCrawler__ class only contains 3 main functions:
  1. __crawlUrl__
  2. __updateUrlList__
  3. __proccessQueue__

####__crawlUrl__
 - Takes a URL, sends a GET request and waits for the response
 - Upon response, takes into consideration the status code (we keep valid responses and throw away 404s and the like)
 - Parses the body of the response to extract all references from the anchor tags; the _href_ in `<a href="/foo"></a>`
 - Passes the list of anchors to __updateUrlList__
 - Emits a _urlProccessed_ event when it is done handling a URL, which tells __proccessQueue__ that we can start a new crawl

####__updateUrlList__
 - This function mainly does two things; Clean the links so they are standardized, and add them to our queue
 - Builds complete URLs from relative ones found in our response ("/about" for example)
 - Removes any trailing hashes for page anchors ("/about#somewhere-on-the-same-page")
 - Removes URL queries ("/about?someQuery=foo&another=bar")
 - Removes URLs that are not in the same domain
 - Adds the clean URLs to the queue if we have not seen them before

####__proccessQueue__
 - This is the start point of the crawl, it calls the first crawl
 - Listens for any _urlProccessed_ events
 - When an event is emitted, it pops the first element of the queue and sends it to be crawled
 - When our queue is empty, it prints the site map

### Considerations
I initially thought it would be more efficient to have __crawlUrl__ recurse on the list of anchors found. While it was faster, it lead to a lot of timeouts and subsequent response errors. It also broke the stack if a site had constantly progessing links (i.e home > about > page1-only-referenced-here > page2 > page3 ... ), after 11 continuous links I would get a stack exceeded error. Also for each deeper recursion level, the program got slower which wasn't ideal.

I went with a much simpler event based crawl, creating a call stack and progressing through it one at a time, appending each new url to the queue and crawling them one by one. This is slower as we're doing requests 1 by 1, but it leads to barely any timeout errors. I probably lost the "bonus points for making it as fast as possible!", but it solved a lot of headaches. We could eventually dispatch events faster (like once the url is cleaned) and have a bunch of concurrent requests, that would make it faster.

I encountered a __lot__ of 404 errors the first time I ran the crawler on [GoCardless.com](http://www.gocardless.com). I ended up realising I wasn't dealing with redirects. Specifically my problem was with http://blog.gocardless.com redirecting me to http://gocardless.com/blog. I was appending relative links on http://gocardless.com/blog to http://blog.gocardless.com because that was the URL I used to get there, but not the actual one on the page (http://blog.gocardless.com/blog/a-story/ yields a 404). This was remedied with a simple check of the URL __after__ we'd received the response.

I was having a lot of un-needed GETs because urls aren't all written uniformly. Some links pointed towards the same address but with either HTTP or HTTPS, those being the same actual link, I decided to normalize the protocol being used. By default it is HTTP but I also added the __-p__ option in the program for configuration... just in case. There is still the same issue with trailing backslashes (i.e "/about/ is treated as different to "/about"), but that is due to RFC specifications, where "/about" could be a file with no extension where as "/about/" is definitively a directory. Simply removing the trailing "/" would bring potential errors.

### Thoughts
 - I ended up realizing a crawler has to factor in __a lot__ of information, staying well structure in how and where you crawl is super important
 - I could work on this for ages and keep adding features
 - I am very grateful I could use a module that dealt with URL standards, so I didn't have to write a ton of regex that would probably ended up having a lot of errors
 - RFC standards helped me a lot
 - I used a handful of great node packages that I had never used
 - I learned is was much easier than I thought to make an npm package for node
 - I don't deal with __robots.txt__. Though I should write a method that fetches it first and follows the crawling rules of the domain
 - Wikipedia.org is not a good place to test your crawler (I gave up after 4 hours)
 - I may have to crawl wikipedia on a server for a few days to see how many pages I find (it would also force me to make this faster)
