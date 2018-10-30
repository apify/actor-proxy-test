const _ = require('underscore');
const { REFRESH_INTERVAL_SECS } = require('./consts');

const { APIFY_DEFAULT_KEY_VALUE_STORE_ID } = process.env;

/**
 * Renders result of test URL.
 *
 * @param  {Object} options
 * @return {String}
 */
const renderUrlResult = ({ url, htmlStoreKey, statusCode, contentType, durationSecs, screenshot, error }) => {
    if (error) return `<h6>${url}</h6><p>Error: ${error}</p>`;

    let screenshotHtml;

    if (!screenshot) {
        screenshotHtml = 'Screenshot is not available for plain HTTP request';
    } else if (screenshot.error) {
        screenshotHtml = `Screenshot error: ${screenshot.error}`;
    } else if (screenshot.buffer) {
        screenshotHtml = `
<a href="https://api.apify.com/v2/key-value-stores/${APIFY_DEFAULT_KEY_VALUE_STORE_ID}/records/${screenshot.storeKey}">
    <img src="data:image/jpeg;base64,${screenshot.buffer.toString('base64')}" width="300" />
</a>`;
    }

    return `<h6>${url}</h6>
<ul>
    <li>Status code: ${statusCode}</li>
    <li>Content type: ${contentType}</li>
    <li>Load time: ${durationSecs}secs</li>
    <li>Html:
        <a href="https://api.apify.com/v2/key-value-stores/${APIFY_DEFAULT_KEY_VALUE_STORE_ID}/records/${htmlStoreKey}" target="_blank">
            View
        </a>
    </li>
</ul>
${screenshotHtml}
`;
};

/**
 * Renders result of one proxyUrl / apifyProxyGroup.
 *
 * @param  {Object} options
 * @param  {Array} options.data
 * @param  {String}  options.proxyTitle
 * @return {String}
 */
const renderTestResult = (data, proxyTitle) => {
    return `<table>
<tr>
    <td colspan="${data.length}"><h5>${proxyTitle}</h5></td>
</tr>
<tr>
    <td>${data.map(renderUrlResult).join('</td><td>')}</td>
</tr>
</table>
<hr />`;
};

/**
 * Renders HTML page.
 *
 * @param  {Object} htmlBody
 * @param  {Object} isRunning If true then meta tag refresh will be added.
 * @return {String}
 */
exports.renderPage = (htmlBody, isRunning) => {
    return `<html>
    <head>
        <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.1.3/css/bootstrap.min.css" />
        <style>
            body { padding: 20px; }
            table td { vertical-align: top; padding: 10px; min-width: 320px; max-width: 320px; font-size: 80%; padding: 10px; }
            h6 { word-break: break-all; }
        </style>
        ${isRunning ? `<meta http-equiv="refresh" content="${REFRESH_INTERVAL_SECS}" />` : ''}
    </head>
    <body>
        ${htmlBody}
    </body>
</html>`;
};

/**
 * Renders results page.
 *
 * @param  {Object} results
 * @param  {Boolean} isRunning
 * @return {String}
 */
exports.renderResult = (results, isRunning) => {
    const groupedResults = _.groupBy(results, 'proxyTitle');

    const resultsHtml = _.chain(groupedResults)
        .mapObject(renderTestResult)
        .toArray()
        .value()
        .join('\n');

    const progressBar = isRunning
        ? `<div class="progress">
    <div
        class="progress-bar progress-bar-striped bg-danger"
        role="progressbar"
        style="width: 100%"
        aria-valuenow="100"
        aria-valuemin="0"
        aria-valuemax="100">
    </div>
</div>`
        : '';

    const bodyHtml = `
<h1>Test results</h1>
${progressBar}
${resultsHtml}`;

    return exports.renderPage(bodyHtml, isRunning);
};
