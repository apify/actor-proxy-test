# actor-proxy-test

This actor simply tests given array of URLs against selected proxy URLs or Apify proxy groups.
Tests can be done using plain HTTP request or full Chromium browser. If browser is selected
then also screenshot is returned in results.

Result is stored under the `OUTPUT` key in the default key-value store. Interim results are displayed in live view.
