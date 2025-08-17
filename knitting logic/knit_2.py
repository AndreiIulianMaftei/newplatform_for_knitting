import ast
import logging
import numpy as np
import pandas as pd
import os

# Configure logging
logging.basicConfig(filename='logfile.log', level=logging.DEBUG, force=True)


class Edge:
    def __init__(self, v, orient, bk, length=1):
        self.v = v
        if orient not in ("h", "v"):
            print("Warning: unknown orient (h or v):", orient)
        self.orient = orient
        if bk not in ("b", "k"):
            print("Warning: unknown bk (bump or keep):", bk)
        self.bk = bk
        self.length = length

    def print(self):
        print(f"v: {self.v}, orient: {self.orient}, bk: {self.bk}, length: {self.length}")


class StitchTechnique:
    def __init__(self, character="k", kill=1, add=1, cursor_dir=False):
        self.character = character
        self.kill = kill
        self.add = add
        self.cursor_dir = cursor_dir

    def print(self):
        print(f"character: {self.character}")
        print(f"kill: {self.kill}")
        print(f"add: {self.add}")
        print(f"cursor_dir: {self.cursor_dir}")


class Stitch:
    def __init__(self, index, character="k", connected=None):
        self.index = index
        self.character = character
        self.connected = connected if connected is not None else []


def get_stitch_by_id(work, row_offset, col_offset, curr):
    row = curr[0] + row_offset
    col = curr[1] + col_offset
    if row < 0 or col < 0:
        return None
    if row < len(work) and col < len(work[row]):
        logging.debug("TRY: %d, %d", row, col)
        return work[row][col]
    return None


def make_edges(edges, needles, place, progression, count):
    """
    Process a list of Edge objects and return lists for behind, below, kill,
    and the complete edge list as tuples.
    """
    sbeh = []  # Stitches behind
    sbel = []  # Stitches below
    skil = []  # Stitches to kill
    edge_list = []

    logging.debug("On the needles: %s", str(needles))
    for edge in edges:
        if edge.orient == 'h':
            if count - 1 >= 0:
                sbeh.append(count - 1)
                edge_list.append((count, count - 1))
        elif edge.orient == 'v':
            stitch_below = needles[place + 1] if progression > 0 else needles[place]
            sbel.append(stitch_below)
            if stitch_below != count - 1:
                edge_list.append((count, stitch_below))
        hi = (
            needles[place + 1 + edge.v[0]]
            if progression > 0
            else needles[place + edge.v[0]]
        )
        if edge.bk == "b":
            skil.append(hi)
    return sbeh, sbel, skil, edge_list


def load_stitch_techniques(filepath):
    """Load the stitch techniques dictionary from the given file."""
    with open(filepath, "r") as file:
        contents = file.read()
    sdict = ast.literal_eval(contents)
    techniques = {}
    for key in sdict.keys():
        techniques[key] = StitchTechnique(
            sdict[key]["character"],
            sdict[key]["kill"],
            sdict[key]["add"],
            sdict[key]["cursor_dir"],
        )
    return techniques


def process_pattern_file(pattern_filepath, stitch_techniques):
    """
    Process a pattern file by tokenizing each line, applying stitch techniques,
    and building the edge list.
    """
    pat_name = pattern_filepath.split("/")[-1].split(".")[0]
    with open(pattern_filepath, "r") as file:
        lines = file.readlines()

    # Initialize variables
    stitches = []         # List of all stitches
    right_needle = []     # Active stitches on the right needle
    left_needle = []      # Active stitches on the left needle
    work = [[]]           # Stitches worked so far
    edges = []            # List of connections (edges)
    place = 0             # Cursor position index
    count = 0             # Total number of stitches
    progression = 1
    round_work = False
    edge_flag = True
    weight_h = 1
    weight_v = 1.5

    for line in lines:
        line = line.strip()
        if not line:
            continue
        logging.debug("Processing line: %s", line)
        tokens = [token.strip() for token in line.split(" ") if token.strip()]
        for s in tokens:
            logging.debug("Current stitch token: %s", s)
            if s in stitch_techniques:
                tech = stitch_techniques[s]
                if tech.cursor_dir:
                    left_needle, right_needle = right_needle.copy(), left_needle.copy()
                    edge_flag = True
                added_stitches = []
                for _ in range(tech.add):
                    right_needle.append(count)
                    added_stitches.append(count)
                    if not edge_flag:
                        edges.append([count, count - 1, weight_h])
                    else:
                        edge_flag = False
                    count += 1
                for _ in range(tech.kill):
                    if left_needle:
                        used_st = left_needle.pop()
                        for st in added_stitches:
                            edges.append([used_st, st, weight_v])
                    else:
                        logging.error("Left needle is empty while processing kill stitches.")
                logging.debug("Edges: %s, Total stitches: %d", str(edges), count)
            elif s.startswith("c"):
                # Handle cable stitches (e.g. c4c)
                num = int(s[1:-1])
                held_stitches = []
                for _ in range(num // 2):
                    if left_needle:
                        held_stitches.append(left_needle.pop())
                for _ in range(num // 2):
                    right_needle.append(count)
                    if left_needle:
                        used = left_needle.pop()
                        edges.append([used, count, weight_v])
                        edges.append([count, count - 1, weight_h])
                        count += 1
                for st in held_stitches:
                    right_needle.append(count)
                    edges.append([st, count, weight_v])
                    edges.append([count, count - 1, weight_h])
                    count += 1
            else:
                print(f"ERROR: Unknown stitch '{s}', stopping")
                return None, None, None
    return edges, count, pat_name


def write_dot_and_csv(edges, count, pat_name):
    """Write the graph as a DOT file and the adjacency matrix as CSV."""
    # Build the adjacency matrix
    adj = np.zeros((count, count), dtype=int)
    for e in edges:
        adj[e[0], e[1]] = 1

    dot_filepath = f"dot/{pat_name}.dot"
    with open(dot_filepath, "w") as out:
        out.write("Graph {\n")
        for e in edges:
            out.write(f"  {e[0]} -- {e[1]} [weight={e[2]}];\n")
        out.write("}\n")

    df = pd.DataFrame(adj)
    # csv_filepath = f"matrices/{pat_name}.csv"
    # df.to_csv(csv_filepath, index=False)
    # logging.info("DOT file written to %s and CSV file to %s", dot_filepath, csv_filepath)


def main():
    stitch_techniques = load_stitch_techniques("stitches_2.txt") # what is this?

    pattern_dir = "new_patterns/"
    pattern_files = [os.path.join(pattern_dir, f) for f in os.listdir(pattern_dir) if os.path.isfile(os.path.join(pattern_dir, f))]

    for pattern_file in pattern_files:
        
        if os.path.isdir(pattern_file):
            print(f"Skipping directory: {pattern_file}")
            continue
        try:
            print(f"Processing pattern: {pattern_file}")
            result = process_pattern_file(pattern_file, stitch_techniques)
            if result is None:
                print(f"Failed to process pattern: {pattern_file}")
                continue
            edges, count, pat_name = result
            write_dot_and_csv(edges, count, pat_name)
            print(f"Successfully processed pattern: {pattern_file}")
        except Exception as e:
            print(f"An error occurred while processing pattern: {pattern_file}. Error: {e}")


if __name__ == "__main__":
    main()
