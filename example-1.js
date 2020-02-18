//
// Run me with --expose-gc
// 
// node --expose-gc example.js
//

const { AsyncTracker } = require("./lib/async-tracker");

function doTimeout() {
    console.log("Starting timeout.");

    setTimeout(() => {
        console.log("Timeout finished.");
    }, 2000);
}

const asyncTracker = new AsyncTracker();
asyncTracker.notifyComplete(() => console.log("All done!"));
asyncTracker.initTrackingContext("test-1", doTimeout);
