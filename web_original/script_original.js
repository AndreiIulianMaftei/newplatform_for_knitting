document.getElementById('processBtn').addEventListener('click', () => {
    const input = document.getElementById('patternInput').value;
    const graphData = parseKnittingPattern(input);
    
    //for testing purposes, you can use a dummy JSON file
    dummyRender('acorn-3.json'); 
    //renderGraph(graphData);
});

function parseKnittingPattern(text) {
    // Dummy parser - replace with real logic as needed
    console.log("Parsing knitting pattern:", text);
    const lines = text.trim().split('\n');
    const nodes = lines.map((line, i) => ({ id: i, label: line }));
    const links = lines.slice(1).map((_, i) => ({ source: i, target: i + 1 }));
    return { nodes, links };
}

function dummyRender(path){
    d3.json(path).then(data => {
        renderGraph(data);
    });
}

function renderGraph(data) {
    var nodes = data.nodes;
    var edges = data.links;

    const ndict = {};
    const adjDict = {};
    const edgeDict = {}


    var svg = d3.select("#graph");
    svg.selectAll("*").remove();

    const width = +svg.attr("width");
    const height = +svg.attr("height");

    svg = d3.select("#graph").append("g")

    function handleZoom(e) {
         svg.attr('transform', e.transform);    
    }

    let zoom2 = d3.zoom()
        .on('zoom', handleZoom);

    d3.select("#graph")
    .call(zoom2);

    var extentx = d3.extent(nodes, d => d.x);
    var extenty = d3.extent(nodes, d => d.y);

    var xscale = d3.scaleLinear()
    .domain([0, 1000])
    .range([0, width]);

    var yscale = d3.scaleLinear()
        .domain([0, 1000])
        .range([0, height]);

        nodes.forEach(element => {
        element.x = (element.x - extentx[0]) / (extentx[1] - extentx[0]) * 1000;
        element.y = (element.y - extenty[0]) / (extenty[1] - extenty[0]) * 1000;

        // Uncomment the following lines to randomize initial positions
        // element.x = Math.random();
    //   element.y = Math.random();

        element.vx = 0;
        element.vy = 0;

        element.x_old = element.x;
        element.y_old = element.y;

        ndict[element.id] = element;
        adjDict[element.id] = new Set();
        edgeDict[element.id] = {};
        });

        edges.forEach(e => {
        adjDict[e.source].add(ndict[e.target]);
        adjDict[e.target].add(ndict[e.source]);

        var src = e.source;
        var tgt = e.target;

        edgeDict[e.source][e.target] = e;
        edgeDict[e.target][e.source] = e;

        //e.real = true;
        })

    const edge = svg.append("g")
        .selectAll("line")
        .data(edges)
        .join("line")
        .attr('class', 'edge')


    const node = svg.append("g")
        .selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("class", "node")
        .attr("r", 3)

    var counter = 0; 
    const simulation = d3.forceSimulation(nodes)
        .velocityDecay(0.7)
        .alpha(1)
        .alphaDecay(0.00128)
        .force("link", d3.forceLink(edges).id(d => d.id).distance(function(d) {return d.weight * 30;}).iterations(40))  
        .force("charge", d3.forceManyBody().strength(-15).distanceMin(30))
        .force("collide", d3.forceCollide(20))  // this one has to changhe maybe
        .on('tick', function() {
            nodes = nodes.sort();

            nodes.forEach(n => {
              var pos = {'x': n.x_old + n.vx, 'y': n.y_old + n.vy};
              var wiggle = 0;

              while(wiggle < 2) {
                var safe = true;
                adjDict[n.id].forEach(n2 => {
                    var pos2 = {'x': n2.x_old, 'y': n2.y_old};

                    //checking against all edges
                    for(var i = 0; i < edges.length; i++) {
                      var e = edges[i];

                      if (e.source.id === n.id || e.target.id === n.id || 
                          e.source.id === n2.id || e.target.id === n2.id) continue;

                      // Access x_old and y_old directly from the e.source and e.target node objects.
                      const pos3 = { x: e.source.x_old, y: e.source.y_old };
                      const pos4 = { x: e.target.x_old, y: e.target.y_old };
                      if(doSegmentsIntersect(pos, pos2, pos3, pos4)) {
                        safe = false;
                        break;
                      }
                    }

                    if(!safe) return;
                });
                
                if (!safe) {
                  n.x = n.x_old;
                  n.y = n.y_old;

                  /*
                  this is the code for the wiggle effect (15 units in a random direction)
                  There is also a version that uses the velocity to move the node slightly towards its target postion
                  And another version that moves in the opposite direction.
                  */
                  // pos = {'x': n.x_old + n.vx * 0.1, 'y': n.y_old  + n.vy * 0.1};
                  // pos = {'x': n.x_old - n.vx * 0.3, 'y': n.y_old  - n.vy * 0.3};
                  pos = {'x': n.x_old + (Math.random() - 0.5) * 30, 'y': n.y_old + (Math.random() - 0.5) * 30};
                  wiggle += 1
                } else {
                  wiggle = 10;
                  
                  n.x = pos.x;
                  n.y = pos.y;
                }

                n.x_old = n.x;
                n.y_old = n.y;
              }
            })

            if(counter++ % 10 == 0) {
              //console.log("Counter", counter);
              var remaining_energy = d3.sum(nodes, d => d.vx * d.vx + d.vy * d.vy) / nodes.length;
              //console.log("Nodes", remaining_energy);

              if (remaining_energy < 0.01) {
                console.log("Stopping simulation");
                simulation.alpha(0);
              }
            }

            node
              .attr('cx', d => xscale(d.x))
              .attr('cy', d => yscale(d.y))

            edge
              .attr('x1', d => xscale(d.source.x))
              .attr('y1', d => yscale(d.source.y))
              .attr('x2', d => xscale(d.target.x))
              .attr('y2', d => yscale(d.target.y))

          })
          .on('end', function() {
              console.log("end tick");

              var c = 0;

              var ub = 5.01;
              var lb = 0.01;


              while((ub - lb) > 0.0001) {
                var mid = (ub + lb) / 2;

                var c1 = 0;
                var c2 = 0;
                edges.forEach(e => {
                  var n1 = e.source;
                  var n2 = e.target;
                  var dist = Math.sqrt((n1.x - n2.x) ** 2 + (n1.y - n2.y) ** 2);
                  var dist1 = dist * mid;
                  var dist2 = dist * (mid + 0.0001);

                  c1 += ((dist1 - 30 * e.weight) / (30 * e.weight)) ** 2
                  c2 += ((dist2 - 30 * e.weight) / (30 * e.weight)) ** 2
                });

                if (c1 < c2) {
                  ub = mid;
                } else {
                  lb = mid;
                }
              }

              console.log("DEL", c1, mid);

              if (onComplete) onComplete();
            });
}


function orientation(a, b, c) {
        // Cross product of vector ab and ac
        const val = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
        if (val === 0) return 0; // Colinear
        return val > 0 ? 1 : 2; // Clockwise or counterclockwise
    }

    function onSegment(a, b, c) {
        return Math.min(a.x, c.x) <= b.x && b.x <= Math.max(a.x, c.x) &&
            Math.min(a.y, c.y) <= b.y && b.y <= Math.max(a.y, c.y);
    }

function doSegmentsIntersect(p1, p2, q1, q2) {
    const o1 = orientation(p1, p2, q1);
    const o2 = orientation(p1, p2, q2);
    const o3 = orientation(q1, q2, p1);
    const o4 = orientation(q1, q2, p2);

    // General case
    if (o1 !== o2 && o3 !== o4) return true;

    // Special cases
    if (o1 === 0 && onSegment(p1, q1, p2)) return true;
    if (o2 === 0 && onSegment(p1, q2, p2)) return true;
    if (o3 === 0 && onSegment(q1, p1, q2)) return true;
    if (o4 === 0 && onSegment(q1, p2, q2)) return true;

    return false;
}
