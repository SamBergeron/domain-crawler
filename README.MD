Shortcomings:
- This doesn't deal with robots.txt
- No authentication, this only supports easy access web pages and pages returning 200 status

Considerations:
- Takes into account different protocols (right now only http and https), and normalizes the URLs accordingly (ie. http://gocardless.com and https://gocardless.com should be the same)
- Takes into account URLs with fragments or hashes (ie. http://gocardless.com/about#somewhere-on-this-page is the same as http://gocardless.com/about)
