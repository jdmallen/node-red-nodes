
module.exports = function(RED) {
    "use strict";
    var fs = require('fs');
    var Tail = require('tail').Tail;

    function TailNode(n) {
        RED.nodes.createNode(this,n);

        this.filename = n.filename || "";
        this.filetype = n.filetype || "text";
        this.split = new RegExp(n.split.replace(/\\r/g,'\r').replace(/\\n/g,'\n').replace(/\\t/g,'\t') || "[\r]{0,1}\n");
        var node = this;

        node.tout = null;

        var fileTail = function() {
            if (fs.existsSync(node.filename)) {
                if (node.filetype === "text") {
                    node.tail = new Tail(node.filename,{separator:node.split, flushAtEOF:true});
                }
                else {
                    node.tail = new Tail(node.filename,{separator:null, flushAtEOF:true, encoding:"binary"});
                }

                node.tail.on("line", function(data) {
                    if (data.length > 0) {
                        var msg = { topic:node.filename };
                        if (node.filetype === "text") {
                            msg.payload = data.toString();
                            node.send(msg);
                        }
                        else {
                            msg.payload = Buffer.from(data,"binary");
                            node.send(msg);
                        }
                    }
                });

                node.tail.on("error", function(err) {
                    node.status({ fill: "red",shape:"ring", text: "node-red:common.status.error" });
                    node.error(err.toString());
                });
            }
            else {
                scheduleRestart();
                node.warn(RED._("tail.errors.filenotfound") + ": "+node.filename);
            }
        }

        var scheduleRestart = function() {
            node.tout = setTimeout(function() {
                node.tout = null;
                fileTail();
            }, 10000);
        };

        var cancelRestart = function() {
            if (isRestartPending()) {
                clearTimeout(node.tout);
                node.tout = null;
            }
        };

        var isRestartPending = function() {
            return node.tout !== null;
        };

        if (node.filename !== "") {
            node.status({});
            fileTail();
        } else {
            node.status({ fill: "grey", text: "tail.state.stopped" });
            node.on('input', function (msg) {
                if (!msg.hasOwnProperty("filename")) {
                    node.error(RED._("tail.state.nofilename"));
                } else if (msg.filename === "") {
                    node.filename = "";
                    if (node.tail) { node.tail.unwatch(); }
                    cancelRestart();
                    node.status({ fill: "grey", text: "tail.state.stopped" });
                } else {
                    node.filename = msg.filename;
                    if (node.tail) { node.tail.unwatch(); }
                    if (!isRestartPending()) { fileTail(); }
                    node.status({ fill: "green", text: node.filename });
                }
            });
        }

        node.on("close", function() {
            /* istanbul ignore else */
            if (node.tail) { node.tail.unwatch(); }
            delete node.tail;
            cancelRestart();
        });
    }

    RED.nodes.registerType("tail",TailNode);
}
