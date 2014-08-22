/* jshint -W040, -W083, unused:false */
(function hdpLoader (window, d3, Promise, undefined) {
    "use strict";

    if (!window) throw new Error("Attepted to load hdp into invalid environment");
    if (!d3) throw new Error("hdp dependency unmet: d3");
    if (!Promise) throw new Error("hdp dependency unmet: RSVP Promise");

    var width = 600,
        height = 200,
        cb,
        defC = d3.rgb(140,140,140),
        dotR = 3,
        domTarget = "body",
        inmarg = {top: 10, right: 10, bottom: 10, left: 10},
        labels,
        age,
        gender,
        group,
        gui, controls,
        caps,
        capsg,
        points,
        color_capsg,
        color_caps,
        color_label,
        color_age,
        line,
        svg;


    /**
     * Contstructor
     */
    function HDP (config) {
        var jsonInputs = {
            "hd.json": loaded_hd,
            "hd_age.json": loaded_hd_age,
            "hd_caps.json": loaded_hd_caps,
            "hd_capscore.json": loaded_hd_capscore,
            "hd_gender.json": loaded_hd_gender,
            "hdl.json": loaded_hdl
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
                    case 'cb':
                        cb = configValue;
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

        initPaint();
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

    var DCmap = function() {
        this.example = 'exploring data';
        this.step = 0;
        this.cGroups = false;
        this.cAge = false;
        this.cGender = false;
        this.cCaps = false;
        this.cCapscore = false;
    };


    var rangesplit = function(v,n){
        var range=d3.max(v)-d3.min(v),
            step=range/n;
        return _.range(d3.min(v),(n+1)*step,step);
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

    function initGUI () {
        gui = new dat.GUI();
        controls = new DCmap();
        gui.add(controls, 'example');
        var c_color = gui.add(controls, 'cGroups', false).name('patient vs. controls');
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
            }else{
                wipe();
            }
        });

        var n_caps = gui.add(controls, 'cCapscore', false).name('cognitive decline');
        n_caps.onChange(function(value) {
            if (value){
                paint(caps, color_caps);
            }else{
                wipe();
            }
        });
    }

    function initPaint () {
        line = d3.svg.line()
                .x(function(d) {
                    return d[0];
                })
                .y(function(d){
                    return d[1];
                })
                .interpolate("linear");
        svg = d3.select(domTarget).append("svg")
                .attr("width", width)
                .attr("height", height)
                .style("position","relative");
        group = svg.append("g")
                .attr({
                    transform: "translate("+[60,150]+")"
                });
        initGUI();
    }



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

    function paint (value, colscale){
        svg.selectAll("circle")
            .attr("title", function(d) {return d;})
            .style("fill", function (d, i){
                return d3.rgb(colscale(value[i]));});
    }

    function wipe () {
        svg.selectAll("circle")
            .attr("title", "")
            .style("fill", function (d,i){
                return defC;
            });
    }

    if (typeof module !== "undefined" && typeof require !== "undefined") {
        module.exports = HDP;
    } else if (window.HDP) {
        throw new Error("HDP exists on the window.  Overwriting not permitted.");
    } else {
        window.HDP = HDP;
    }

    //svg.on("click", animate);
})(window, window.d3, window.RSVP.Promise);