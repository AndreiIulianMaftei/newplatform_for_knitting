#!/usr/bin/env python3
"""
Script to convert knitting_graph(2).json format to acorn-3.json format.
The script transforms the node and edge structure to match the NetworkX JSON format.
"""

import json
import sys
import argparse


def convert_knitting_to_acorn(input_file, output_file):
    """
    Convert knitting graph format to acorn-3.json format.
    
    Args:
        input_file (str): Path to input knitting graph JSON file
        output_file (str): Path to output acorn format JSON file
    """
    
    # Load the knitting graph data
    with open(input_file, 'r') as f:
        knitting_data = json.load(f)
    
    # Initialize the acorn format structure
    acorn_data = {
        "directed": False,
        "multigraph": False,
        "graph": {
            "node_default": {},
            "edge_default": {},
            "name": "G"
        },
        "nodes": [],
        "links": []
    }
    
    # Convert nodes
    for node in knitting_data["nodes"]:
        acorn_node = {
            "id": str(node["id"]),  # Convert to string as in acorn format
            "x": float(node["x"]),
            "y": float(node["y"])
        }
        acorn_data["nodes"].append(acorn_node)
    
    # Convert edges to links
    for i, edge in enumerate(knitting_data["edges"]):
        acorn_link = {
            "id": str(i),  # Sequential ID for each link
            "source": str(edge["source"]),  # Convert to string
            "target": str(edge["target"]),  # Convert to string
            "weight": float(edge["weight"])
        }
        acorn_data["links"].append(acorn_link)
    
    # Write the converted data
    with open(output_file, 'w') as f:
        json.dump(acorn_data, f, separators=(',', ':'))
    
    print(f"Successfully converted {input_file} to {output_file}")
    print(f"Converted {len(acorn_data['nodes'])} nodes and {len(acorn_data['links'])} links")


def main():
    """Main function to run the conversion with command-line argument support."""
    parser = argparse.ArgumentParser(
        description="Convert knitting graph JSON to acorn-3 JSON format"
    )
    parser.add_argument(
        "input_file", 
        nargs="?", 
        default="knitting_graph(3).json",
        help="Input knitting graph JSON file (default: knitting_graph(2).json)"
    )
    parser.add_argument(
        "output_file",
        nargs="?", 
        default="acorn-3.json",
        help="Output acorn format JSON file (default: acorn-3.json)"
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Enable verbose output"
    )
    
    args = parser.parse_args()
    
    try:
        convert_knitting_to_acorn(args.input_file, args.output_file)
        if args.verbose:
            print(f"Input file: {args.input_file}")
            print(f"Output file: {args.output_file}")
    except FileNotFoundError as e:
        print(f"Error: {e}")
        print("Make sure the input file exists in the current directory.")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"An error occurred: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()