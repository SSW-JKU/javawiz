<#
.SYNOPSIS
Prompts the user for a filename, recursively finds files with that name in the
current directory and its subdirectories, and replaces their content with the
content of 'C:\<filename>', preserving the original 'package' line if present.  Also removes BOM.

.DESCRIPTION
This script first asks the user to enter the name of the file they want to search
for (e.g., 'In.java', 'Out.java'). It then searches the current directory and
all subdirectories for files matching that name. For each file found, it reads
the content of the corresponding source file located at 'C:\<filename>'.
Before writing the new content, it checks the *original* target file for a line
starting with 'package ' and ending with ';'. If found, this package line is
prepended to the new content before overwriting the target file. The script also removes any Byte Order Mark (BOM) from the files it processes.

.NOTES
Author: Gemini
Date: 2025-04-09
Ensure that the corresponding source file (e.g., 'C:\In.java' if you enter 'In.java')
exists and contains the desired content before running this script.
Run this script from the top-level directory where you want the search to start.
Be cautious, as this script overwrites file content without backup.
The script attempts to preserve the first 'package ...;' line found in the original file.
#>

# --- Get User Input ---
# Prompt the user to enter the filename they want to search for and replace.
$targetFileName = Read-Host -Prompt "Please enter the filename to search for (e.g., In.java)"

# Validate user input - check if the user actually entered something.
if ([string]::IsNullOrWhiteSpace($targetFileName)) {
    Write-Error "No filename entered. Script cannot proceed."
    exit 1
}

# --- Define Paths ---
# Construct the source file path dynamically based on user input.
$sourceFilePath = "C:\$targetFileName"

# Get the current directory path.
$startDirectory = Get-Location

# --- Pre-run Check ---
# Check if the dynamically determined source file exists.
Write-Host "Checking for source file: '$sourceFilePath'"
if (-not (Test-Path -Path $sourceFilePath -PathType Leaf)) {
    Write-Error "Source file not found: '$sourceFilePath'. Please ensure this file exists before running the script."
    # Exit the script if the source file doesn't exist.
    exit 1
}

# --- Read Source Content ---
# Read the content from the source file that will replace the target content.
$replacementContent = "" # Initialize to empty string
try {
    # Use -Raw for better performance and line ending preservation.
    $replacementContent = Get-Content -Path $sourceFilePath -Raw -ErrorAction Stop
    Write-Host "Successfully read content from '$sourceFilePath'."
}
catch {
    Write-Error "Failed to read content from '$sourceFilePath'. Error: $($_.Exception.Message)"
    exit 1
}


# --- Find and Replace ---
Write-Host "Starting search for '$targetFileName' in '$($startDirectory.Path)' and subdirectories..."

# Find all files matching the target name recursively from the current directory.
# -File ensures we only get files, not directories.
# -ErrorAction SilentlyContinue ignores errors like access denied for specific folders.
$targetFiles = Get-ChildItem -Path $startDirectory.Path -Filter $targetFileName -Recurse -File -ErrorAction SilentlyContinue

# Check if any files were found
if ($targetFiles.Count -eq 0) {
    Write-Host "No files named '$targetFileName' found in '$($startDirectory.Path)' or its subdirectories."
} else {
    Write-Host "Found $($targetFiles.Count) file(s) named '$targetFileName'. Starting replacement..."

    # Loop through each found file.
    foreach ($file in $targetFiles) {
        Write-Host "Processing file: $($file.FullName)"
        $packageLine = $null
        $originalContent = $null
        $finalContent = $replacementContent # Default to the new content

        try {
            # Read the original content of the target file to check for a package line.
            $originalContent = Get-Content -Path $file.FullName -Encoding Byte -Raw -ErrorAction Stop

            # Remove BOM if present
            if ($originalContent.Length -ge 3 -and $originalContent[0] -eq 0xEF -and $originalContent[1] -eq 0xBB -and $originalContent[2] -eq 0xBF) {
                $originalContent = $originalContent[3..($originalContent.Length-1)]
                Write-Host "  BOM removed from original file."
            }

            # Convert the byte array back to a string for package line detection
            $originalContentString = [System.Text.Encoding]::UTF8.GetString($originalContent)

            # Check if the original content contains a package declaration using regex.
            # (?m) enables multiline mode, ^ matches start of line, \s* allows leading whitespace.
            if ($originalContentString -match '(?m)^\s*package\s+.*;') {
                # Package line found, store the first match. Trim whitespace.
                $packageLine = $matches[0].Trim()
                Write-Host "  Found package line: '$packageLine'"
            } else {
                Write-Host "  No package line found in original file."
            }
        }
        catch {
            Write-Warning "Could not read original content of '$($file.FullName)' to check for package line. Error: $($_.Exception.Message). Proceeding without preserving package line."
        }

        # If a package line was found, prepend it to the replacement content.
        if (-not [string]::IsNullOrEmpty($packageLine)) {
            # Use [Environment]::NewLine for correct newline character (\r\n or \n).
            $finalContent = "$packageLine$([Environment]::NewLine)$replacementContent"
            Write-Host "  Prepending package line to the new content."
        }

        try {
            # Convert the final content string to a byte array using UTF8 encoding
            $finalContentBytes = [System.Text.Encoding]::UTF8.GetBytes($finalContent)
            # Overwrite the content of the target file with the final content (potentially including the package line).
            # Use -Force to overwrite read-only files if necessary (use with caution).
            [System.IO.File]::WriteAllBytes($file.FullName, $finalContentBytes)
            Write-Host "Successfully replaced content in: $($file.FullName)"
        }
        catch {
            # Output error message if writing fails for a specific file.
            Write-Error "Failed to replace content in '$($file.FullName)'. Error: $($_.Exception.Message)"
            # Continue to the next file instead of exiting the script.
            continue
        }
    }
    Write-Host "Finished processing all found files."
}

Write-Host "Script execution completed."
