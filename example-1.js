//
// Run me with --expose-gc
// 
// node --expose-gc example.js
//

const { AsyncDebugger } = require("./lib/async-debugger");

function doTimeout() {
    console.log("Starting timeout.");

    setTimeout(() => {
        console.log("Timeout finished.");
    }, 2000);
}

const asyncDebugger = new AsyncDebugger();
asyncDebugger.notifyComplete(() => console.log("All done!"));
asyncDebugger.startTracking("test-1", doTimeout);
