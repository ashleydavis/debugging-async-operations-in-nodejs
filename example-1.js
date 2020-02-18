//
// Run me with --expose-gc
// 
// node --expose-gc example.js
//

const { AsyncTracker: AsyncDebugger } = require("./lib/async-debugger");

function doTimeout() {
    console.log("Starting timeout.");

    setTimeout(() => {
        console.log("Timeout finished.");
    }, 2000);
}

const asyncTracker = new AsyncDebugger();
asyncTracker.notifyComplete(() => console.log("All done!"));
asyncTracker.startTracking("test-1", doTimeout);
