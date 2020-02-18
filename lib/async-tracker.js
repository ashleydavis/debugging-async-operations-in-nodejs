const async_hooks = require("async_hooks");
const fs = require("fs");

//
// Invoke a callback function when all async operations have completed.
//
function checkAsyncOps(asyncTracker, callback) {

    if (global.gc) {
        global.gc();
    }

    if (asyncTracker.getNumAsyncOps() === 0) {
        callback();
        return;
    }

    setTimeout(() => checkAsyncOps(asyncTracker, callback), 0);
}

//
// Tracks asynchronous operations in specific segments of code.
//
class AsyncTracker {

    //
    // Tracks async operations currently in progress.
    //
    curAsyncOps = new Map();

    //
    // Async operations at the root of the hierarchy.
    //
    rootAsyncOps = new Map();

    //
    // Records all async operations that have ever happened.
    //
    allAsyncOps = new Map();

    //
    // Records the top-level execution contexts currently being tracked.
    //
    executionContexts = new Set();

    //
    // Maps execution context ids to labels.
    //
    labelMap = new Map();

    //
    // Records the number of async operations in progress for each label.
    //
    numAsyncOps = new Map();

    //
    // Execute a callback when all async operations have completed.
    // Don't call this from inside the tracking context! 
    // It includes async operations that will hang the tracking process.
    //
    notifyComplete(callback) {
        setTimeout(() => checkAsyncOps(this, callback), 0);
    }

    //
    // Track async operations initiated by the passed in function in a new async context.
    //
    initTrackingContext(label, fn) {
        this.lazyInit(); // Lazy initialise.

        const executionContext = new async_hooks.AsyncResource(label);
        executionContext.runInAsyncScope(() => { // Initiate a new execution context whose child async operations we will track.
            const executionContextAsyncId = async_hooks.executionAsyncId(); // Record the async ID for the new execution context.
            this.executionContexts.add(executionContextAsyncId);
            this.labelMap.set(executionContextAsyncId, label);
            fn(); // Run user code in the new async execution context.
        });
    }

    //
    // Determine the number of async operations for the requested label.
    //
    getNumAsyncOps(label) {
        if (label !== undefined) {
            return this.numAsyncOps.get(label) || 0;
        }
        else {
            return this.curAsyncOps.size;
        }
    }

    //
    // Debug print details of async operations.
    //
    dump() {
        const numAsyncOps = {};
        for (const entry of this.numAsyncOps.entries()) { // Translate to a hash of labels.
            numAsyncOps[this.labelMap.get(entry[0])] = entry[1];
        }

        fs.writeSync(1, `total #ops: ${this.getNumAsyncOps()}\n`);
        fs.writeSync(1, `#ops per context: ${JSON.stringify(numAsyncOps, null, 4)}\n`);
    }
    
    //
    // Lazily initialise the tracker.
    //
    lazyInit() {
        if (!this.asyncHook) {
            //
            // Create the async hook.
            //
            this.asyncHook = async_hooks.createHook({ 
                init: (asyncId, type, triggerAsyncId, resource) => {
                    this.addAsyncOperation(asyncId, type, triggerAsyncId, resource);
                },
                destroy: asyncId => {
                    this.removeAsyncOperation(asyncId, "it was destroyed");
                },
                promiseResolve: asyncId => {
                    this.removeAsyncOperation(asyncId, "it was resolved");
                },
            });
        }
        
        this.asyncHook.enable();
    }

    //
    // Disable the tracker.
    //
    deinit() {
        if (this.asyncHook) {
            this.asyncHook.disable();
        }
    }

    //
    // Gets the execution context (if found) for a particular async ID.
    // Returns undefined if not found.
    //
    findExecutionContextId(asyncId) {
        if (this.executionContexts.has(asyncId)) {
            return asyncId; // This is the id of the execution context!
        }

        const asyncOp = this.allAsyncOps.get(asyncId);
        if (asyncOp) {
            return asyncOp.executionContextId;
        }

        return undefined; // This async operation is not being tracked!
    }

    //
    // Records an async operation.
    //
    addAsyncOperation(asyncId, type, triggerAsyncId, resource) {

        const executionContextId = this.findExecutionContextId(triggerAsyncId);
        if (executionContextId === undefined) {
            return; // This async operation is not being tracked!
        }
            
        // The triggering async operation has been traced back to a particular execution context.

        const error = {};
        Error.captureStackTrace(error);

        const stack = error.stack.split("\n").map(line => line.trim());
        
        const asyncOp = {
            asyncId,
            type,
            triggerAsyncId,
            resource,
            children: new Map(),
            stack,
            status: "in-flight",
            executionContextId,
        };

        const parentOperation = this.allAsyncOps.get(triggerAsyncId);
        if (parentOperation) {
            parentOperation.children.set(asyncId, asyncOp); // Record the hierarchy of asynchronous operations.
        }
        else {
            this.rootAsyncOps.set(asyncId, asyncOp);
        }

        this.curAsyncOps.set(asyncId, asyncOp);
        this.allAsyncOps.set(asyncId, asyncOp);

        //
        // Track the async operations for each execution context.
        //
        this.numAsyncOps.set(executionContextId, (this.numAsyncOps.get(executionContextId) || 0) + 1);
            
        fs.writeSync(1, `%% add ${asyncId}, type = ${type}, parent = ${triggerAsyncId}, context = ${executionContextId}, ${this.labelMap.get(executionContextId)} #ops = ${this.numAsyncOps.get(executionContextId)}, total #ops = ${this.curAsyncOps.size}\n`);
        // fs.writeSync(1, `-- stack\n${stack.join('\n')}\n`);
   }

    //
    // Removes an async operation.
    //
    removeAsyncOperation(asyncId, reason) {
        const asyncOp = this.curAsyncOps.get(asyncId)
        if (!asyncOp) {
            // This async operation is not tracked.
            return;
        }

        asyncOp.status = "completed";

        this.curAsyncOps.delete(asyncId);

        const executionContextId = this.findExecutionContextId(asyncId);
        if (executionContextId !== undefined) {
            const numAsyncOps = this.numAsyncOps.get(executionContextId);
            if (numAsyncOps !== undefined) {
                this.numAsyncOps.set(executionContextId, numAsyncOps-1);
                fs.writeSync(1, `%% remove ${asyncId}, reason = ${reason}, context = ${executionContextId}, ${this.labelMap.get(executionContextId)} #ops = ${this.numAsyncOps.get(executionContextId)}, total #ops = ${this.curAsyncOps.size}.\n`);
            }
        }
    }
}

module.exports = {
    AsyncTracker,
};