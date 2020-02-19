//
// Run me with --expose-gc
// 
// node --expose-gc example.js
//

const { AsyncDebugger } = require("./lib/async-debugger");

console.log("Starting up!"); 

function doTimeout() {
    console.log("Starting timeout.");

    setTimeout(() => {
        
        setTimeout(() => {
            console.log("Timeout finished.");
        }, 2000);
    
    }, 2000);
}

const asyncDebugger = new AsyncDebugger();
asyncDebugger.notifyComplete(() => console.log("********** All done! **********"));
asyncDebugger.startTracking("test-1", doTimeout);

console.log("End of script");
