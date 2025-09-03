#!/usr/bin/env python3
"""
Script to analyze knitting stitches from CSV files and categorize them as good or bad
based on predefined stitch techniques.
"""

import os
import csv
import re
from collections import defaultdict
import glob

def load_known_stitches():
    """Load the known stitch techniques."""
    known_stitches = {
        "k", "co", "yo", "bo", "p", "kfb", "kfb3", "kfb4", "kfb5", 
        "kfb3-3", "ssk", "k2tog", "p2tog", "k3tog", "turn", "knit", "purl"
    }
    return known_stitches

def is_valid_stitch(stitch, known_stitches):
    """
    Check if a stitch is valid based on known stitches and patterns.
    
    Args:
        stitch (str): The stitch to check
        known_stitches (set): Set of known stitch names
    
    Returns:
        bool: True if stitch is valid, False otherwise
    """
    stitch = stitch.lower().strip()
    
    # Direct match with known stitches
    if stitch in known_stitches:
        return True
    
    # Check for kx pattern (k followed by numbers)
    if re.match(r'^k\d+$', stitch):
        return True
    
    # Check for px pattern (p followed by numbers)
    if re.match(r'^p\d+$', stitch):
        return True
    
    # Check for k-x pattern (k with dash and numbers, like k1-b)
    if re.match(r'^k\d*-[a-z]+$', stitch):
        return True
    
    # Check for p-x pattern (p with dash and numbers/letters)
    if re.match(r'^p\d*-[a-z]+$', stitch):
        return True
    
    # Check for variants like k2tog-b, ssk-b, etc.
    if re.match(r'^(k\d*tog|ssk|p\d*tog)-[a-z]+$', stitch):
        return True
    
    return False

def extract_stitches_from_text(text):
    """
    Extract individual stitches from a text string.
    
    Args:
        text (str): Text containing stitch instructions
    
    Returns:
        list: List of individual stitches found
    """
    if not text or text.strip() == '*':
        return []
    
    # Clean the text
    text = text.strip().lower()
    
    # Remove common punctuation and separators
    text = re.sub(r'[,;]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    
    # Split by spaces to get individual tokens
    tokens = text.split()
    
    stitches = []
    for token in tokens:
        # Remove leading/trailing punctuation
        token = re.sub(r'^[^\w]+|[^\w]+$', '', token)
        if token:
            stitches.append(token)
    
    return stitches

def analyze_csv_file(filepath, known_stitches):
    """
    Analyze a single CSV file for stitch patterns.
    
    Args:
        filepath (str): Path to the CSV file
        known_stitches (set): Set of known stitch names
    
    Returns:
        tuple: (good_stitches, bad_stitches, filename)
    """
    good_stitches = set()
    bad_stitches = set()
    filename = os.path.basename(filepath)
    
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as file:
            # Try to detect if first line is header
            first_line = file.readline()
            file.seek(0)
            
            # Skip if file is empty
            if not first_line.strip():
                return good_stitches, bad_stitches, filename
            
            reader = csv.DictReader(file)
            
            for row in reader:
                # Check different possible column names for repeat patterns
                repeat_columns = ['Repeat', 'repeat', 'Repeat From *', 'Begin Row']
                
                for col_name in repeat_columns:
                    if col_name in row and row[col_name]:
                        stitches = extract_stitches_from_text(row[col_name])
                        
                        for stitch in stitches:
                            if is_valid_stitch(stitch, known_stitches):
                                good_stitches.add(stitch)
                            else:
                                bad_stitches.add(stitch)
    
    except Exception as e:
        print(f"Error processing {filename}: {e}")
    
    return good_stitches, bad_stitches, filename

def main():
    """Main function to analyze all CSV files in the stitches folder."""
    
    # Set up paths
    stitches_folder = "/home/andrei/c++/newplatform/stitches"
    
    # Load known stitches
    known_stitches = load_known_stitches()
    
    # Get all CSV files
    csv_files = glob.glob(os.path.join(stitches_folder, "*.csv"))
    
    if not csv_files:
        print(f"No CSV files found in {stitches_folder}")
        return
    
    print(f"Found {len(csv_files)} CSV files to analyze...")
    
    # Categorize files as valid or invalid
    valid_files = []
    invalid_files = []
    
    # Analyze each file
    for i, filepath in enumerate(csv_files, 1):
        if i % 100 == 0:
            print(f"Processed {i}/{len(csv_files)} files...")
        
        good_stitches, bad_stitches, filename = analyze_csv_file(filepath, known_stitches)
        
        # If file has any bad stitches, it's invalid; otherwise, it's valid
        if bad_stitches:
            invalid_files.append(filename)
        else:
            valid_files.append(filename)
    
    # Sort the file lists
    valid_files.sort()
    invalid_files.sort()
    
    # Write separate list files for easy iteration
    valid_files_list = "valid_files_list.txt"
    invalid_files_list = "invalid_files_list.txt"
    summary_file = "stitch_analysis_summary.txt"
    
    # Write valid files list (one file per line for easy iteration)
    with open(valid_files_list, 'w') as f:
        for filename in valid_files:
            f.write(f"{filename}\n")
    
    # Write invalid files list (one file per line for easy iteration)
    with open(invalid_files_list, 'w') as f:
        for filename in invalid_files:
            f.write(f"{filename}\n")
    
    # Write summary file
    with open(summary_file, 'w') as f:
        f.write("KNITTING FILES ANALYSIS SUMMARY\n")
        f.write("=" * 50 + "\n\n")
        f.write(f"Total CSV files analyzed: {len(csv_files)}\n")
        f.write(f"Valid files: {len(valid_files)}\n")
        f.write(f"Invalid files: {len(invalid_files)}\n\n")
        f.write("Files created:\n")
        f.write(f"- {valid_files_list}\n")
        f.write(f"- {invalid_files_list}\n")
        f.write(f"- {summary_file}\n")
    
    # Print summary to console
    print(f"\nAnalysis complete!")
    print(f"Valid files: {len(valid_files)}")
    print(f"Invalid files: {len(invalid_files)}")
    print(f"\nFiles created:")
    print(f"- Valid files list: {valid_files_list}")
    print(f"- Invalid files list: {invalid_files_list}")
    print(f"- Summary: {summary_file}")
    
    if invalid_files:
        print(f"\nFirst 10 invalid files:")
        for filename in invalid_files[:10]:
            print(f"  {filename}")

if __name__ == "__main__":
    main()
