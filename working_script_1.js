let nodes = [];
let edges = [];
let positionedNodes = []; // Store nodes with x,y coordinates
let stitchTechniques = {};

/**
 * Load stitch technique definitions
 * @returns {Object} Dictionary of stitch techniques
 */
function loadStitchTechniques() {
    return {
        "k": { character: "k", kill: 1, add: 1, cursor_dir: false },
        "co": { character: "k", kill: 0, add: 1, cursor_dir: false },
        "yo": { character: "k", kill: 0, add: 1, cursor_dir: false },
        "bo": { character: "k", kill: 1, add: 0, cursor_dir: false },
        "p": { character: "p", kill: 1, add: 1, cursor_dir: false },
        "kfb": { character: "k", kill: 1, add: 2, cursor_dir: false },
        "kfb3": { character: "k", kill: 1, add: 3, cursor_dir: false },
        "kfb4": { character: "k", kill: 1, add: 4, cursor_dir: false },
        "kfb5": { character: "k", kill: 1, add: 5, cursor_dir: false },
        "kfb3-3": { character: "k", kill: 3, add: 3, cursor_dir: false },
        "ssk": { character: "k", kill: 2, add: 1, cursor_dir: false },
        "k2tog": { character: "k", kill: 2, add: 1, cursor_dir: false },
        "p2tog": { character: "p", kill: 2, add: 1, cursor_dir: false },
        "k3tog": { character: "k", kill: 3, add: 1, cursor_dir: false },
        "turn": { character: "k", kill: 0, add: 0, cursor_dir: true }
    };
}

/**
 * Parse knitting pattern into graph nodes and edges
 * @param {string} pattern - Raw knitting pattern text
 * @returns {Object} Result object with nodes, edges, success status, and error message
 */
function parsePattern(pattern) {
    const lines = pattern.trim().split('\n');
    
    const allNodes = [];
    const allEdges = [];
    let rightNeedle = [];     // Active stitches on right needle
    let leftNeedle = [];      // Stitches waiting to be worked
    let count = 0;            // Global stitch ID counter
    let edgeFlag = true;      // Controls horizontal edge creation
    const weightH = 1;        // Horizontal edge weight
    const weightV = 1.5;      // Vertical edge weight
    
    stitchTechniques = loadStitchTechniques();
    
    try {
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            
            const tokens = trimmedLine.split(/\s+/).filter(token => token.trim());
            
            for (let i = 0; i < tokens.length; i++) {
                const s = tokens[i];
                const stitch = s.toLowerCase();
                console.log(`Processing stitch: ${stitch}, count: ${count}`);
                
                // Handle cast-on with number (co 6 or co6)
                if (stitch === 'co' || stitch.startsWith('co')) {
                    let castOnCount = 1; // default
                    
                    if (stitch === 'co') {
                        if (i + 1 < tokens.length) {
                            const nextToken = tokens[i + 1];
                            const num = parseInt(nextToken);
                            if (!isNaN(num)) {
                                castOnCount = num;
                                i++; 
                            }
                        }
                    } else if (stitch.startsWith('co')) {
                        const num = parseInt(stitch.substring(2));
                        if (!isNaN(num)) {
                            castOnCount = num;
                        }
                    }
                    
                    // Create cast-on stitches
                    for (let j = 0; j < castOnCount; j++) {
                        rightNeedle.push(count);
                        
                        const node = {
                            id: count,
                            type: 'co',
                            character: 'k',
                            technique: stitchTechniques['co'],
                        };
                        allNodes.push(node);
                        
                        if (!edgeFlag && count > 0) {
                            allEdges.push({
                                source: count - 1,
                                target: count,
                                weight: weightH,
                                type: 'horizontal'
                            });
                        } else {
                            edgeFlag = false;
                        }
                        
                        count++;
                    }
                }
                else if (stitch in stitchTechniques) {
                    const tech = stitchTechniques[stitch];
                    
                    if (tech.cursor_dir) {
                        const temp = [...rightNeedle];
                        rightNeedle = [...leftNeedle];
                        leftNeedle = temp;
                        edgeFlag = true;
                    }
                    
                    const addedStitches = [];
                    for (let j = 0; j < tech.add; j++) {
                        rightNeedle.push(count);
                        addedStitches.push(count);
                        
                        const node = {
                            id: count,
                            type: stitch,
                            character: tech.character,
                            technique: tech,
                        };
                        allNodes.push(node);
                        
                        if (!edgeFlag && count > 0) {
                            allEdges.push({
                                source: count - 1,
                                target: count,
                                weight: weightH,
                                type: 'horizontal'
                            });
                        } else {
                            edgeFlag = false;
                        }
                        
                        count++;
                    }
                    
                    for (let j = 0; j < tech.kill; j++) {
                        if (leftNeedle.length > 0) {
                            const usedStitch = leftNeedle.pop();
                            
                            for (const addedStitch of addedStitches) {
                                allEdges.push({
                                    source: usedStitch,
                                    target: addedStitch,
                                    weight: weightV,
                                    type: 'vertical'
                                });
                            }
                        } else if (tech.kill > 0) {
                            throw new Error(`Left needle is empty while processing kill stitches for ${stitch}`);
                        }
                    }
                }
                else if (stitch.startsWith('c') && stitch.endsWith('c')) {
                    // Handle cable patterns if needed
                    console.log(`Cable pattern detected: ${stitch} - not implemented`);
                }
                else {
                    throw new Error(`Unknown stitch '${stitch}'`);
                }
                
                console.log(`After ${stitch}: rightNeedle=${rightNeedle}, leftNeedle=${leftNeedle}, edges=${allEdges.length}`);
            }
            
            if (rightNeedle.length > 0) {
                leftNeedle = [...rightNeedle];
                rightNeedle = [];
                edgeFlag = true;
            }
        }
        
        return { 
            nodes: allNodes, 
            edges: allEdges, 
            success: true, 
            error: null 
        };
        
    } catch (error) {
        console.error('Parsing error:', error);
        return { 
            nodes: [], 
            edges: [], 
            success: false, 
            error: error.message 
        };
    }
}


async function addPlanarLayout(nodeData, edgeData, scale = 200, center = {x: 400, y: 300}) {
    if (nodeData.length === 0) {
        return [];
    }
    
    try {
        // Initialize Pyodide if not already loaded
        if (!window.pyodide) {
            window.pyodide = await loadPyodide();
            await window.pyodide.loadPackage(["networkx"]);
        }
        
        const graphData = {
            nodes: nodeData,
            edges: edgeData,
            scale: scale,
            center: center
        };
        
        window.pyodide.globals.set("graph_data", graphData);
        
        // Python code for planar layout computation
        const pythonCode = `
import networkx as nx

# Get data from JavaScript
data = graph_data.to_py()
nodes = data['nodes']
edges = data['edges']
scale = data['scale']
center = data['center']

# Create NetworkX graph
G = nx.Graph()

# Add nodes with attributes
for node in nodes:
    G.add_node(node['id'], **node)

# Add edges with attributes  
for edge in edges:
    G.add_edge(edge['source'], edge['target'], **edge)

# Check if graph is planar and compute layout
try:
    is_planar, embedding = nx.check_planarity(G)
    
    if is_planar:
        pos = nx.planar_layout(G, scale=scale)
        print(f"Graph is planar. Using planar layout for {len(nodes)} nodes.")
    else:
        # Fallback to spring layout if not planar
        pos = nx.spring_layout(G, scale=scale)
        print(f"Graph is not planar. Using spring layout fallback for {len(nodes)} nodes.")
        
except Exception as e:
    print(f"Layout computation failed: {e}")
    # Final fallback to circular layout
    pos = nx.circular_layout(G, scale=scale)
    print(f"Using circular layout as final fallback for {len(nodes)} nodes.")

# Apply positions to nodes
positioned_nodes = []
for node in nodes:
    node_copy = dict(node)
    node_id = node['id'];
    
    if node_id in pos:
        node_copy['x'] = float(pos[node_id][0]) + center['x']
        node_copy['y'] = float(pos[node_id][1]) + center['y']
    else:
        node_copy['x'] = center['x']
        node_copy['y'] = center['y']
        
    positioned_nodes.append(node_copy)

result = positioned_nodes
`;
        
        // Execute Python code
        await window.pyodide.runPython(pythonCode);
        
        // Get result from Python
        const result = window.pyodide.globals.get('result').toJs({dict_converter: Object.fromEntries});
        return result;
        
    } catch (error) {
        console.warn('Python planar layout failed:', error.message, '- using fallback positioning');
        
        // Fallback to JavaScript circular layout
        const positionedNodes = nodeData.map(node => ({ ...node }));
        positionedNodes.forEach((node, index) => {
            const angle = (2 * Math.PI * index) / positionedNodes.length;
            node.x = center.x + scale * Math.cos(angle);
            node.y = center.y + scale * Math.sin(angle);
        });
        return positionedNodes;
    }
}


async function addGridLayout(nodeData, edgeData, gridSpacing = 40, center = {x: 400, y: 300}) {
    console.log('addGridLayout called with:', nodeData.length, 'nodes');
    
    if (nodeData.length === 0) {
        console.log('No nodes to layout, returning empty array');
        return [];
    }
    
    const positionedNodes = nodeData.map(node => ({ ...node }));
    
    // Group nodes into rows based on horizontal edge connectivity
    const rowGroups = [];
    let currentRow = [];
    
    // Sort nodes by ID to ensure they are processed in creation order
    const sortedNodes = [...positionedNodes].sort((a, b) => a.id - b.id);
    
    for (let i = 0; i < sortedNodes.length; i++) {
        const node = sortedNodes[i];
        
        if (currentRow.length === 0) {
            // Start the first row
            currentRow.push(node);
        } else {
            // Check for a horizontal edge to the previous node in the sorted list
            const prevNode = sortedNodes[i - 1];
            const hasHorizontalEdge = edgeData.some(edge => 
                edge.type === 'horizontal' && 
                ((edge.source === prevNode.id && edge.target === node.id) ||
                 (edge.target === prevNode.id && edge.source === node.id))
            );
            
            if (hasHorizontalEdge) {
                // If connected, it's part of the same row
                currentRow.push(node);
            } else {
                // If not connected, the previous row is finished
                if (currentRow.length > 0) {
                    rowGroups.push([...currentRow]);
                }
                // Start a new row with the current node
                currentRow = [node];
            }
        }
    }
    
    // Add the last processed row
    if (currentRow.length > 0) {
        rowGroups.push(currentRow);
    }
    
    console.log('Row groups:', rowGroups.map(row => row.map(n => `${n.type}(${n.id})`)));
    
    // Calculate grid dimensions
    const maxRowWidth = Math.max(...rowGroups.map(row => row.length));
    const numRows = rowGroups.length;
    const verticalSpacing = gridSpacing * 0.8; // Make rows tighter vertically
    
    console.log(`Knitting grid: ${numRows} rows, max width: ${maxRowWidth} stitches`);
    
    // Calculate starting position to center the grid
    const gridWidth = (maxRowWidth - 1) * gridSpacing;
    const gridHeight = (numRows - 1) * verticalSpacing;
    const startX = center.x - gridWidth / 2;
    const startY = center.y - gridHeight / 2;
    
    console.log(`Grid starting position: (${startX}, ${startY}), spacing: ${gridSpacing}`);
    
    // Position nodes by knitting rows (bottom to top)
    rowGroups.forEach((row, rowIndex) => {
        const rowY = startY + (numRows - 1 - rowIndex) * verticalSpacing; // Bottom row first
        const rowWidth = (row.length - 1) * gridSpacing;
        
        // Add horizontal offset for alternating rows to create a staggered look
        const horizontalOffset = (rowIndex % 2 === 0) ? 0 : gridSpacing / 2;
        const rowStartX = center.x - rowWidth / 2 + horizontalOffset;
        
        // Reverse node order for alternating rows to simulate knitting flow
        const processedRow = (rowIndex % 2 !== 0) ? [...row].reverse() : row;
        
        processedRow.forEach((node, colIndex) => {
            node.x = rowStartX + colIndex * gridSpacing;
            node.y = rowY;
            
            console.log(`Node ${node.id} (${node.type}): row ${rowIndex}, col ${colIndex} -> screen (${node.x}, ${node.y})`);
        });
    });
    
    console.log(`Knitting grid layout applied for ${positionedNodes.length} nodes in ${numRows} rows`);
    return positionedNodes;
}

/**
 * Apply force simulation with edge crossing avoidance using original algorithm
 * @param {Array} positionedNodes - Nodes with initial x,y coordinates from planar/grid layout
 * @param {Array} edgeData - Edge dataset
 * @param {Function} onComplete - Callback function when simulation completes
 * @returns {Promise} - Promise that resolves when simulation is complete
 */
function applyForceSimulation(positionedNodes, edgeData, onComplete = null) {
    console.log('=== STARTING applyForceSimulation ===');
    console.log('Input positionedNodes:', positionedNodes);
    console.log('positionedNodes.length:', positionedNodes.length);
    console.log('Input edgeData:', edgeData);
    console.log('edgeData.length:', edgeData.length);
    
    return new Promise((resolve) => {
        // Convert to the format expected by original algorithm
        var nodes = positionedNodes.map(node => ({ ...node }));
        console.log('Converted nodes:', nodes);
        var edges = edgeData.map(edge => ({ 
            ...edge, 
            source: edge.source, 
            target: edge.target,
            weight: edge.weight || 1
        }));
        console.log('Converted edges:', edges);

        const ndict = {};
        const adjDict = {};
        const edgeDict = {};

        var svg = d3.select("#graph");
        svg.selectAll("*").remove();

        const width = +svg.attr("width");
        const height = +svg.attr("height");

        svg = d3.select("#graph").append("g");

        function handleZoom(e) {
             svg.attr('transform', e.transform);    
        }

        let zoom2 = d3.zoom()
            .on('zoom', handleZoom);

        d3.select("#graph")
        .call(zoom2);

        var extentx = d3.extent(nodes, d => d.x);
        var extenty = d3.extent(nodes, d => d.y);

        console.log('Node position extents:', extentx, extenty);
        console.log('Sample node positions before normalization:', nodes.slice(0, 3).map(n => ({id: n.id, x: n.x, y: n.y})));

        var xscale = d3.scaleLinear()
        .domain([0, 1000])
        .range([0, width]);

        var yscale = d3.scaleLinear()
            .domain([0, 1000])
            .range([0, height]);

        nodes.forEach(element => {
            const oldX = element.x;
            const oldY = element.y;
            element.x = (element.x - extentx[0]) / (extentx[1] - extentx[0]) * 1000;
            element.y = (element.y - extenty[0]) / (extenty[1] - extenty[0]) * 1000;
            
            // Check for NaN values
            if (isNaN(element.x) || isNaN(element.y)) {
                console.warn(`NaN position detected for node ${element.id}:`, {oldX, oldY, newX: element.x, newY: element.y, extentx, extenty});
                element.x = 500; // fallback position
                element.y = 300;
            }

            element.vx = 0;
            element.vy = 0;

            element.x_old = element.x;
            element.y_old = element.y;

            ndict[element.id] = element;
            adjDict[element.id] = new Set();
            edgeDict[element.id] = {};
        });

        edges.forEach(e => {
            // Store the original source and target IDs before D3 converts them to objects
            const sourceId = e.source;
            const targetId = e.target;
            
            adjDict[sourceId].add(ndict[targetId]);
            adjDict[targetId].add(ndict[sourceId]);

            edgeDict[sourceId][targetId] = e;
            edgeDict[targetId][sourceId] = e;
        });

        const edge = svg.append("g")
            .selectAll("line")
            .data(edges)
            .join("line")
            .attr('class', 'edge')
            .attr("stroke", d => d.type === 'horizontal' ? '#999' : '#666')
            .attr("stroke-width", d => d.weight || 1)
            .attr("stroke-dasharray", d => d.type === 'horizontal' ? "3,3" : "none");

        const node = svg.append("g")
            .selectAll("circle")
            .data(nodes)
            .join("circle")
            .attr("class", "node")
            .attr("r", 8)
            .attr("fill", d => getStitchColor(d.type))
            .attr("stroke", "#333")
            .attr("stroke-width", 1.5);

        // Add labels
        const labels = svg.append("g")
            .selectAll("text")
            .data(nodes)
            .join("text")
            .text(d => `${d.type}(${d.id})`)
            .attr("font-size", "10px")
            .attr("fill", "#333")
            .attr("dx", 12)
            .attr("dy", 4);

        var counter = 0; 
        console.log('Starting D3 force simulation with', nodes.length, 'nodes and', edges.length, 'edges');
        const simulation = d3.forceSimulation(nodes)
            .velocityDecay(0.7)
            .alpha(1)
            .alphaDecay(0.00128)
            .force("link", d3.forceLink(edges).id(d => d.id).distance(function(d) {return d.weight * 30;}).iterations(40))  
            .force("charge", d3.forceManyBody().strength(-15).distanceMin(30))
            .force("collide", d3.forceCollide(20))
            .on('tick', function() {
                if (counter === 0) {
                    console.log('First tick! Simulation is running');
                }
                // Remove the sort as it may be causing issues
                // nodes = nodes.sort();

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
                  var remaining_energy = d3.sum(nodes, d => d.vx * d.vx + d.vy * d.vy) / nodes.length;

                  if (remaining_energy < 0.01) {
                    console.log("Stopping simulation");
                    simulation.alpha(0);
                  }
                }

                node
                  .attr('cx', d => xscale(d.x))
                  .attr('cy', d => yscale(d.y));

                edge
                  .attr('x1', d => xscale(d.source.x))
                  .attr('y1', d => yscale(d.source.y))
                  .attr('x2', d => xscale(d.target.x))
                  .attr('y2', d => yscale(d.target.y));

                labels
                  .attr('x', d => xscale(d.x))
                  .attr('y', d => yscale(d.y));

              })
              .on('end', function() {
                  console.log("end tick");

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
                  resolve();
                });
    });
}

/**
 * Render the graph using positioned nodes and D3.js
 * @param {Array} positionedNodes - Nodes with x,y coordinates
 * @param {Array} edgeData - Edge dataset
 */
function renderGraph(positionedNodes, edgeData) {
    const svg = d3.select("#graph");
    svg.selectAll("*").remove();
    
    // Create groups for edges and nodes
    const edgeGroup = svg.append("g").attr("class", "edges");
    const nodeGroup = svg.append("g").attr("class", "nodes");
    
    // Draw edges with center-to-center connections
    edgeGroup.selectAll("line")
        .data(edgeData)
        .enter()
        .append("line")
        .attr("class", d => `edge ${d.type}`)
        .attr("x1", d => {
            const source = positionedNodes.find(n => n.id === d.source);
            return source ? source.x : 0;
        })
        .attr("y1", d => {
            const source = positionedNodes.find(n => n.id === d.source);
            return source ? source.y : 0;
        })
        .attr("x2", d => {
            const target = positionedNodes.find(n => n.id === d.target);
            return target ? target.x : 0;
        })
        .attr("y2", d => {
            const target = positionedNodes.find(n => n.id === d.target);
            return target ? target.y : 0;
        })
        .attr("stroke", d => d.type === 'horizontal' ? '#999' : '#666')
        .attr("stroke-width", d => d.weight || 1)
        .attr("stroke-dasharray", d => d.type === 'horizontal' ? "3,3" : "none");
    
    // Draw nodes with smaller circles
    const nodeElements = nodeGroup.selectAll("g")
        .data(positionedNodes)
        .enter()
        .append("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.x}, ${d.y})`);
    
    nodeElements.append("circle")
        .attr("r", 8)
        .attr("fill", d => getStitchColor(d.type))
        .attr("stroke", "#333")
        .attr("stroke-width", 1.5);
    
    nodeElements.append("text")
        .attr("dx", 12)
        .attr("dy", 4)
        .text(d => `${d.type}(${d.id})`)
        .attr("font-size", "10px")
        .attr("fill", "#333");
}

/**
 * Get color for different stitch types
 * @param {string} stitchType - Type of stitch
 * @returns {string} Hex color code
 */
function getStitchColor(stitchType) {
    const colors = {
        'co': '#4CAF50',    // Cast-on - Green
        'k': '#2196F3',     // Knit - Blue
        'p': '#FF9800',     // Purl - Orange
        'kfb': '#8BC34A',   // Knit front back - Light green
        'k2tog': '#F44336', // Knit 2 together - Red
        'ssk': '#F44336',   // Slip slip knit - Red
        'yo': '#E91E63',    // Yarn over - Pink
        'bo': '#9C27B0',    // Bind off - Purple
        'turn': '#607D8B',  // Turn - Blue grey
        'cable_front': '#795548',
        'cable_back': '#A1887F'
    };
    return colors[stitchType] || '#999';
}

/**
 * Download data as JSON file
 * @param {Object|Array} data - Data to download
 * @param {string} filename - Name of the file
 */
function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Helper functions for force simulation with edge crossing avoidance
 */

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

/**
 * Main application initialization
 */
document.addEventListener('DOMContentLoaded', function() {
    const processBtn = document.getElementById('processBtn');
    const patternInput = document.getElementById('patternInput');
    const controls = document.getElementById('controls');
    
    // Process pattern button
    processBtn.addEventListener('click', async function() {
        const pattern = patternInput.value.trim();
        
        if (!pattern) {
            alert('Please enter a knitting pattern');
            return;
        }
        
        // Get selected layout type
        const selectedLayout = document.querySelector('input[name="layoutType"]:checked').value;
        console.log('Selected layout:', selectedLayout);
        
        processBtn.disabled = true;
        processBtn.textContent = 'Processing...';
        
        try {
            const result = parsePattern(pattern);
            
            if (!result.success) {
                alert('Error parsing pattern: ' + result.error);
                return;
            }
            
            nodes = result.nodes;
            edges = result.edges;
            
            console.log('Parsed nodes:', nodes.length, 'edges:', edges.length);
            
            // Apply selected initial layout
            let layoutNodes;
            if (selectedLayout === 'grid') {
                console.log('Applying grid layout...');
                layoutNodes = await addGridLayout(nodes, edges);
                console.log('Grid layout completed, positioned nodes:', layoutNodes.length);
            } else {
                console.log('Applying planar layout...');
                layoutNodes = await addPlanarLayout(nodes, edges);
                console.log('Planar layout completed, positioned nodes:', layoutNodes.length);
            }

            // Store positioned nodes globally for download
            positionedNodes = layoutNodes;

            console.log('Starting force simulation...');
            await applyForceSimulation(layoutNodes, edges);
            console.log('Force simulation completed');
            
            // Show controls
            controls.style.display = 'block';
            
            console.log('Pattern processed successfully');
            console.log('Nodes:', nodes.length);
            console.log('Edges:', edges.length);
            console.log('Initial layout:', selectedLayout);
            
        } catch (error) {
            alert('Error processing pattern: ' + error.message);
            console.error('Processing error:', error);
        } finally {
            processBtn.disabled = false;
            processBtn.textContent = 'Process Pattern';
        }
    });
    
    // Force simulation button
    document.getElementById('simulationLayoutBtn')?.addEventListener('click', async () => {
        if (nodes.length === 0) {
            alert('Please process a pattern first');
            return;
        }
        
        try {
            const button = document.getElementById('simulationLayoutBtn');
            button.disabled = true;
            button.textContent = 'Running Simulation...';
            
            // Get current layout selection
            const selectedLayout = document.querySelector('input[name="layoutType"]:checked').value;
            
            let layoutNodes;
            if (selectedLayout === 'grid') {
                layoutNodes = await addGridLayout(nodes, edges);
            } else {
                layoutNodes = await addPlanarLayout(nodes, edges);
            }
            
            // Store positioned nodes globally for download
            positionedNodes = layoutNodes;
            
            await applyForceSimulation(layoutNodes, edges);
            console.log('Force simulation applied successfully with', selectedLayout, 'layout');
        } catch (error) {
            alert('Error applying force simulation: ' + error.message);
            console.error('Force simulation error:', error);
        } finally {
            const button = document.getElementById('simulationLayoutBtn');
            button.disabled = false;
            button.textContent = 'Force Simulation';
        }
    });

    // Download buttons
    document.getElementById('downloadGraphBtn')?.addEventListener('click', () => {
        if (nodes.length === 0 && edges.length === 0) {
            alert('No graph data to download. Please process a pattern first.');
            return;
        }
        
        // Use positioned nodes with x,y coordinates if available, otherwise original nodes
        const nodesToDownload = positionedNodes.length > 0 ? positionedNodes : nodes;
        console.log('Downloading graph data:', { 
            nodes: nodesToDownload.length, 
            edges: edges.length,
            hasPositions: nodesToDownload.length > 0 && nodesToDownload[0].x !== undefined
        });
        
        downloadJSON({ nodes: nodesToDownload, edges }, 'knitting_graph.json');
    });
});
