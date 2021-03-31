// Theshold for duration of entire script - fails test if script lasts longer than X (in ms)
// Default is '0', which means that it won't fail.
const ScriptTimeout = 0;
// Script-wide timeout for all wait and waitAndFind functions (in ms)
const DefaultTimeout = 20000;

/** HELPER VARIABLES AND FUNCTIONS **/
const req = require('request');
const fs = require('fs');
const assert = require('assert');

const By = $driver.By;
const browser = $browser.manage();
const startTime = Date.now();
let stepStartTime = Date.now();
let prevMsg = '';
let prevStep = 0;
const lastStep = 9999;
const VARS = {};

// This function will log individual steps scripted to the console, as well as total time spent in that step. The duration is also sent to NRDB as an event to query.
const log = function (thisStep, thisMsg) {
  if (thisStep > 1 || thisStep == lastStep) {
    const totalTimeElapsed = Date.now() - startTime;
    const prevStepTimeElapsed = totalTimeElapsed - stepStartTime;
    console.log(
      `Step ${prevStep}: ${prevMsg} FINISHED. It took ${prevStepTimeElapsed}ms to complete.`
    );
    $util.insights.set(`Step ${prevStep}: ${prevMsg}`, prevStepTimeElapsed);
    if (ScriptTimeout > 0 && totalTimeElapsed > ScriptTimeout) {
      throw new Error(
        `Script timed out. ${totalTimeElapsed}ms is longer than script timeout threshold of ${ScriptTimeout}ms.`
      );
    }
  }
  if (thisStep > 0 && thisStep != lastStep) {
    stepStartTime = Date.now() - startTime;
    console.log(`Step ${thisStep}: ${thisMsg} STARTED at ${stepStartTime}ms.`);
    prevMsg = thisMsg;
    prevStep = thisStep;
  }
};

// Function use to download a file based on direct url to file
function downloadFile(url, fileName) {
  const downloadPath = '/tmp/'; // Path to store the downloaded file
  const flow = $driver.promise.controlFlow();
  return flow.execute(function () {
    const p = $driver.promise.defer();
    req
      .get(url)
      .pipe(fs.createWriteStream(downloadPath + fileName)) // get direct download link and pipe response into local path/file name specified
      .on('finish', function () {
        // return 'complete' on download finish
        p.fulfill('complete');
      })
      .on('error', function () {
        // return 'error' if download fails
        p.fulfill('error');
      });
    return p.promise;
  });
}

/** BEGINNING OF SCRIPT **/
console.log('Starting synthetics script: ');
console.log(`Default timeout is set to ${DefaultTimeout / 1000} seconds`);

$browser
  .getCapabilities()
  .then(function () {
    $browser.manage().timeouts().implicitlyWait(20000); // Implicit wait timeout for any steps in script
  })

  // Go to Download Site
  .then(function () {
    log(1, 'Navigate to download.newrelic.com');
    $browser.get('https://download.newrelic.com');
  })

  // Download File
  .then(function () {
    log(2, 'Download File');
    downloadFile('https://download.newrelic.com/548C16BF.gpg', 'testFile').then(
      function (res) {
        console.log(`Download Result: ${res}`); // log the download result
        if (res == 'complete') {
          // set the download status within the SyntheticCheck event type to query
          $util.insights.set('DownloadResult', 'success');
        } else {
          $util.insights.set('DownloadResult', 'failure');
        }
      }
    );
  })

  // last step
  .then(
    function () {
      log(lastStep, '');
      console.log('Browser script execution SUCCEEDED.');
    },
    function (err) {
      console.log('Browser script execution FAILED.');
      throw err;
    }
  );
