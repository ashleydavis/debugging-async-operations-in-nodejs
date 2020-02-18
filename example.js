//
// Run me with --expose-gc
// 
// node --expose-gc example.js
//

const { AsyncTracker } = require("./lib/async-tracker");

const asyncTracker = new AsyncTracker();

function doTimeout() {
    console.log("Starting timeout.");

    setTimeout(() => {
        console.log("Timeout finished.");
    }, 2000);
}

asyncTracker.notifyComplete(() => console.log("Async operations have completed!"));
asyncTracker.initTrackingContext("test-1", doTimeout);
