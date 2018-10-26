const Apify = require('apify');
const Promise = require('bluebird');
const { renderResult } = require('./result_renderer');
const { runPlainHttpTest, browserTest } = require('./test_runner');

Apify.main(async () => {
    const input = await Apify.getValue('INPUT');

    // @TODO hack
    input.proxy.apifyProxyGroups = input.proxy.apifyProxyGroups.map((group) => group.split('-').pop());

    const { testUrls, plainHttpRequest } = input;
    const { useApifyProxy, apifyProxyGroups, proxyUrls } = input.proxy;
    const results = [];
    const testFunction = plainHttpRequest ? runPlainHttpTest : browserTest;

    if (proxyUrls) {
        await Promise.each(proxyUrls, async (proxyUrl) => {
            console.log(`Running tests for proxy URL "${proxyUrl}" ...`);
            results.push({
                uses: `Proxy URL (${proxyUrl})`,
                data: await testFunction({ proxyUrl, plainHttpRequest, testUrls }),
            });
        });
    } else if (useApifyProxy) {
        if (!apifyProxyGroups || !apifyProxyGroups.length) {
            console.log('Running tests for auto mode ...');
            const proxyUrl = Apify.getApifyProxyUrl();
            results.push({
                uses: 'Apify proxy (auto)',
                data: await testFunction({ proxyUrl, plainHttpRequest, testUrls }),
            });
        } else {
            await Promise.each(apifyProxyGroups, async (proxyGroup) => {
                console.log(`Running tests for proxy group "${proxyGroup}" ...`);
                const proxyUrl = Apify.getApifyProxyUrl({ groups: [proxyGroup] });
                results.push({
                    uses: `Apify proxy (${proxyGroup})`,
                    data: await testFunction({ proxyUrl, plainHttpRequest, testUrls }),
                });
            });
        }
    } else {
        console.log('Running tests without proxy ...');
        results.push({
            uses: 'No proxy',
            data: await testFunction({ proxyUrl: null, plainHttpRequest, testUrls }),
        });
    }

    const html = renderResult({ input, results });
    await Apify.setValue('OUTPUT', html, { contentType: 'text/html; charset=utf-8' });
});
