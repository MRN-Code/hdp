"use strict";

var d3 = require('d3');
var range = require('lodash/range');
//var gui = require('dat.gui');
var control = require('control-panel');

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
    vis_id = 'hdp',
    color_capsg,
    color_caps,
    color_label,
    color_age,
    line,
    svg;

var LABEL_GROUP = 'group',
    LABEL_AGE = 'age',
    LABEL_GENDER = 'gender',
    LABEL_DIS_SEV = 'disease severity',
    LABEL_COG_DEC = 'cognitive decline';

/**
 * Constructor
 */
function HDP (config, inputData) {

    var hd = inputData.hd,
        hd_age = inputData.hd_age,
        hd_caps = inputData.hd_caps,
        hd_capscore = inputData.hd_capscore,
        hd_gender = inputData.hd_gender,
        hdl = inputData.hdl;

    var jsonInputs = {
        hd: loaded_hd,
        hd_age: loaded_hd_age,
        hd_caps: loaded_hd_caps,
        hd_capscore: loaded_hd_capscore,
        hd_gender: loaded_hd_gender,
        hdl: loaded_hdl
    },
    loadedPs = [],
    configValue;

    // Load all of the JSON data from files
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
                // Don't need this now?
                case 'cb':
                    cb = configValue;
                    break;
                // DOM element where GUI will sit
                // Don't need this now?
                case 'gui_id':
                    gui_id = configValue;
                    break;
                // Don't need this now?
                case 'guiBefore':
                    // Coerce value to Boolean
                    guiBefore = !!configValue;
                    break;
                // DOM element where visualization will sit
                case 'id':
                    vis_id = configValue;
                    break;
                // DOM element containing both visualization and GUI
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

var guiControls = [
    {type: 'checkbox', label: LABEL_GROUP, initial: false},
    {type: 'checkbox', label: LABEL_AGE, initial: false},
    {type: 'checkbox', label: LABEL_GENDER, initial: false},
    {type: 'checkbox', label: LABEL_DIS_SEV, initial: false},
    {type: 'checkbox', label: LABEL_COG_DEC, initial: false},
];

// Optional GUI parameters
var guiOptParams = {theme: 'dark',
                    position: 'top-left',
                    title: 'exploring data'};


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

/**
 * Callback function for control panel. Calls controlCallback to manage true/false values.
 * @param data: {JSON} state of all inputs that have changed on control panel
 */
function panelCallback (data) {

    if (data.hasOwnProperty(LABEL_GROUP)) {
        controlCallback(data[LABEL_GROUP], labels, color_label);
    } else if(data.hasOwnProperty(LABEL_AGE)) {
        controlCallback(data[LABEL_AGE], age, color_age);
    } else if(data.hasOwnProperty(LABEL_GENDER)) {
        controlCallback(data[LABEL_GENDER], gender, color_label);
    } else if(data.hasOwnProperty(LABEL_DIS_SEV)) {
        controlCallback(data[LABEL_DIS_SEV], capsg, color_capsg);
    } else if(data.hasOwnProperty(LABEL_COG_DEC)) {
        controlCallback(data[LABEL_COG_DEC], caps, color_caps);
    } else {
        throw new Error("Invalid callback key passed (" +
                data + ")");
    }
}

/**
 * Callback function for control panel. Calls controlCallback to manage true/false values.
 * @param data: {JSON} state of all inputs that have changed on control panel
 */
function controlCallback (inputValue, colorValue, colorScale) {
    if (inputValue) {
        paint(colorValue, colorScale);
    } else {
        wipe();
    }
}

HDP.prototype.initGUI = function () {
    //gui = new dat.GUI({autoPlace:false});
    panel = control(guiControls, guiOptParams);
    panel.on('input', panelCallback(data))

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
            "id": vis_id
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
 * Sets circle to color on basis of value
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
