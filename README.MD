# Site Map crawler

#### Usage:
- Download files, make sure nodeJS is installed
- run "npm install"
- run "node crawl.js [url] [outputfile]"
- run "node crawl.js --help" for options

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
 - Checks if the new URLs aren't already proccessed
 - Adds them to a queue of URLs
 - Starts a new crawl for each new URL found this way

####__proccessQueue__
 - This is the start point of the crawl, it calls the first crawl
 - Listens for any _urlProccessed_ events
 - When this event is emitted it removes the crawled URL from the queue
 - When our queue is empty, it prints the site map

### Considerations
I initially thought it would be more efficient to have __crawlUrl__ recurse on the list of anchors found. While it was faster, it lead to a lot of timeouts and subsequent response errors. It also broke the stack if a site had constantly progessing links (i.e home > about > page1-only-referenced-here > page2 > page3 ... ), after 11 continuous links I would get a stack exceeded error. Also for each deeper recursion level, the program got slower which wasn't ideal.

~~I went with a much simpler event based crawl, creating a call stack and progressing through it one at a time, appending each new url to the queue and crawling them one by one. This is slower as we're doing requests 1 by 1, but it leads to barely any timeout errors~~ 

After I wrote this I realized I could progress through the queue much faster if I pooled requests as they arrived, I'm using the same call/listener method but letting Node handle the dispatch in a pool. 

~~I probably lost the "bonus points for making it as fast as possible!", but it solved a lot of headaches~~ By using a request pool, I actually sped up my inital time from __~10 minutes__ to __~10 seconds!!!__.

I encountered a __lot__ of 404 errors the first time I ran the crawler on [GoCardless.com](http://www.gocardless.com). I ended up realising I wasn't dealing with redirects. Specifically my problem was with http://blog.gocardless.com redirecting me to http://gocardless.com/blog. I was appending relative links on http://gocardless.com/blog to http://blog.gocardless.com because that was the URL I used to get there, but not the actual one on the page (http://blog.gocardless.com/blog/a-story/ yields a 404). This was remedied with a simple check of the URL __after__ we'd received the response.

I was having a lot of un-needed GETs because urls aren't all written uniformly. Some links pointed towards the same address but with either HTTP or HTTPS, those being the same actual link, I decided to normalize the protocol being used. By default it is HTTP but I also added the __-p__ option in the program for configuration... just in case. There is still the same issue with trailing backslashes (i.e "/about/ is treated as different to "/about" but that is due to RFC specifications, where "/about" could be a file with no extension where as "/about/" is definitively a directory. Simply removing the trailing "/" would bring potential errors.)

### Thoughts
 - I ended up realizing a crawler has to factor in __a lot__ of information, staying well structured in how and where you crawl is super important
 - I could work on this for ages and keep adding features
 - I am very grateful I could use a module that dealt with URL standards, so I didn't have to write a ton of regex that would probably ended up having a lot of errors
 - RFC standards helped me a lot
 - I used a handful of great node packages that I had never used
 - I learned is was much easier than I thought to make an npm package for node
 - I don't deal with __robots.txt__. Though I should write a method that fetches it first and follows the crawling rules of the domain
 - Wikipedia.org is not a good place to test your crawler (I gave up after 4 hours)
 - I may have to crawl wikipedia on a server for a few days to see how many pages I find
 - Doing a solo project you sometimes get caught in your own ideas, getting other people's opinions is much more fun
