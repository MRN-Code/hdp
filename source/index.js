"use strict";

var d3 = require('d3');
var range = require('lodash/range');
var gui = require('dat.gui');

var width = 600,
    height = 200,
    cb,
    defC = d3.rgb(140,140,140),
    dotR = 3,
    domTarget = 'body',
    inmarg = {top: 10, right: 10, bottom: 10, left: 10},
    labels,
    age,
    gender,
    group,
    gui, guiBefore,
    gui_id = 'hdp_gui',
    controls,
    caps,
    capsg,
    points,
    id = 'hdp',
    color_capsg,
    color_caps,
    color_label,
    color_age,
    line,
    svg;


/**
 * Constructor
 */
function HDP (config, inputData) {
    var jsonInputs = {
        inputData['hd']: loaded_hd,
        inputData['hd_age']: loaded_hd_age,
        inputData['hd_caps']: loaded_hd_caps,
        inputData['hd_capscore']: loaded_hd_capscore,
        inputData['hd_gender']: loaded_hd_gender,
        inputData['hdl']: loaded_hdl
    },
    loadedPs = [],
    configValue;

    // Build array of async fetch promises for all JSON
    for (var dataFile in jsonInputs) {
        if (jsonInputs.hasOwnProperty(dataFile)) {
            loadedPs.push(new Promise(function fetchJSON (resolve, reject) {
                var df = dataFile;
                d3.json(df, function handleJSON (err, data) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve([jsonInputs[df], data]); // resolves to [function, dataInputToFunction]
                });
            }));
        }
    }

    // User initialization
    for (var prop in config) {
        if (config.hasOwnProperty(prop)) {
            configValue = config[prop];
            switch(prop) {
                // User callback
                case 'cb':
                    cb = configValue;
                    break;
                case 'gui_id':
                    gui_id = configValue;
                    break;
                case 'guiBefore':
                    guiBefore = !!configValue;
                    break;
                case 'id':
                    id = configValue;
                    break;
                case 'target':
                    domTarget = configValue;
                    if (domTarget.indexOf('#') !== 0) {
                        throw new Error("# style selector required");
                    }
                    break;
                default:
                    throw new Error("Invalid configuration parameter passed (" +
                            prop + ")");
            }
        }
    }

    this.initPaint();
    Promise.all(loadedPs)
        .then(execJSONhandlers)
        .then(function userCallback () {
            if (cb) cb();
        });
}



/**
 * Executes callbacks once all data has been fetched
 * @param  {Array} execReqs array containing arrays of [callback function, data for callback]
 */
function execJSONhandlers (execReqs) {
    if (!execReqs) throw new Error("No functions/data provided to execute");
    if (!execReqs.length) return;
    execReqs.forEach(function execHandler (fd) {
        fd[0](fd[1]); // fd[0] is a the cb function, fd[1] is the fetched JSON
    });
}

// Control paramaters for GUI
var DCmap = function() {
    this.example = 'exploring data';
    this.step = 0;
    this.cGroups = false;
    this.cAge = false;
    this.cGender = false;
    this.cCaps = false;
    this.cCapscore = false;
};


/**
 * Returns the DOM object of the target
 * domTarget is global var
 * @return {Object} DOM node
 */
function getTargetNode () {
    if (domTarget === 'body') return window.document.body;
    return window.document.getElementById(domTarget.substring(1));
}

/**
 * @param {Array} array to create range {Number} number of steps
 * @return {Array} array of equal steps over a range given by an input array
 */
var rangesplit = function(v,n){
    var rangeSize=d3.max(v)-d3.min(v),
    step=rangeSize/n;
    return range(d3.min(v),(n+1)*step,step);
};

var colors = [
    [160,28,158],
    [254,220,128],
    [150,51,31],
    [10,124,122],
    [159,224,61],
    [148,199,226],
    [61,179,224],
    [240,219,62],
    [231,230,222],
    [151,150,120],
    [1,177,181],
    [130,135,137]
];

HDP.prototype.initGUI = function () {
    gui = new dat.GUI({autoPlace:false});
    controls = new DCmap();
    gui.add(controls, 'example');
    var c_color = gui.add(controls, 'cGroups', false).name('patient vs. controls');
    this.chkPatientControls = c_color.domElement.childNodes[0];
    c_color.onChange(function(value) {
        if (value){
            paint(labels, color_label);
        }else{
            wipe();
        }
    });

    var c_age = gui.add(controls, 'cAge', false).name('age');
    c_age.onChange(function(value) {
        if (value){
            paint(age, color_age);
        }else{
            wipe();
        }
    });

    var c_gender = gui.add(controls, 'cGender', false).name('gender');
    c_gender.onChange(function(value) {
        if (value){
            paint(gender, color_label);
        }else{
            wipe();
        }
    });

    var c_caps = gui.add(controls, 'cCaps', false).name('disease severity');
    c_caps.onChange(function(value) {
        if (value){
            paint(capsg, color_capsg);
        } else{
            wipe();
        }
    });

    var n_caps = gui.add(controls, 'cCapscore', false).name('cognitive decline');
    this.chkCogDecline = n_caps.domElement.childNodes[0];
    n_caps.onChange(function(value) {
        if (value){
            paint(caps, color_caps);
        } else{
            wipe();
        }
    });
    gui.domElement.id = gui_id;
    if (guiBefore) {
        getTargetNode().insertBefore(gui.domElement, getTargetNode().firstChild);
    } else {
        getTargetNode().appendChild(gui.domElement);
    }
};

HDP.prototype.initPaint = function () {
    line = d3.svg.line()
        .x(function(d) {
            return d[0];
        })
    .y(function(d){
        return d[1];
    })
    .interpolate("linear");
    svg = d3.select(domTarget).append("svg")
        .attr({
            "width": width,
            "height": height,
            "id": id
        })
    .style("position","relative");
    group = svg.append("g")
        .attr({
            transform: "translate("+[60,150]+")"
        });
    this.initGUI();
};

/**
 * Callbacks for different data sources
 * Set values for variables, including labels and colors
 */

function loaded_hdl (data) {
    labels = data;
    color_label = d3.scale.linear()
        .domain(d3.extent(labels))
        .range([colorbrewer.Accent[8][4],colorbrewer.Accent[8][5]])
        .interpolate(d3.interpolateLab);
}

function loaded_hd_age (data) {
    age = data;
    color_age = d3.scale.linear()
        .domain(rangesplit(age,9))
        .range(colorbrewer.Greys[9])
        .interpolate(d3.interpolateLab);
}

function loaded_hd_gender (data) {
    gender = data;
}

function loaded_hd_caps (data) {
    capsg = data;
    color_capsg = d3.scale.ordinal()
        .domain([0,1,2,3])
        .range(["white","yellow","orange","red"]);
}

function loaded_hd_capscore (data) {
    caps = data;
    color_caps = d3.scale.linear()
        .domain(rangesplit(caps,9))
        .range(colorbrewer.Reds[9])
        .interpolate(d3.interpolateLab);
}


function loaded_hd (data) {
    points = data;
    var xscale = d3.scale.linear()
        .domain(d3.extent(points, function(d){return d[0];}))
        .range([inmarg.left, width-inmarg.right]);
    var yscale = d3.scale.linear()
        .domain(d3.extent(points, function(d){return d[1];}))
        .range([height-inmarg.top, inmarg.bottom]);

    svg.selectAll("circle").data(points).enter()
        .append("circle")
        .style("fill", defC)
        .style("stroke", function(d) { return d3.rgb(0,0,0); })
        .style("stroke-width", 0.1)
        .attr({
            title: "",
            r:  dotR,
            cx: function(d) {return xscale(d[0]);},
            cy: function(d) {return yscale(d[1]);}
        })
    .on("mouseover", function() {
        d3.select(this)
            .attr("r", function (d) { return 2*dotR; })
            .style("fill-opacity", 0.8); })
        .on("mouseout", function() {
            d3.select(this)
                .attr("r", function (d) { return dotR; })
                .style("fill-opacity", 1.0); });
}

/**
 * Sets all circles to default color
 */
function paint (value, colscale){
    svg.selectAll("circle")
        .attr("title", function(d) {return d;})
        .style("fill", function (d, i){
            return d3.rgb(colscale(value[i]));});
}

/**
 * Sets all circles to default color
 */
function wipe () {
    svg.selectAll("circle")
        .attr("title", "")
        .style("fill", function (d,i){
            return defC;
        });
}

module.exports = HDP;
