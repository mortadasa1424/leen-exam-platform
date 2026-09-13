<#
.SYNOPSIS
  Phase B (import) helper for /ingest-questions. Copies embedded media out
  of a .docx into a target asset directory, byte-for-byte, with no
  resizing/recompression/transcoding. Does not rename or correlate images
  to questions -- that mapping comes from docx-inspect.ps1's
  media-order.txt (reading order) plus your own reading of document.xml,
  and you pass the final descriptive filenames explicitly via -Rename.

.DESCRIPTION
  Zero-dependency: uses .NET's built-in System.IO.Compression.ZipFile.

  Safety: never overwrites an existing file in -OutDir unless -Force is
  passed. Reports what it wrote, what it skipped (already existed), and
  (with -RelsPath) which media entries in the docx were never referenced
  from document.xml at all -- candidates for "don't copy this, it's
  leftover/unused" per the main Skill's instructions.

.PARAMETER DocxPath
  Path to the source .docx file.

.PARAMETER OutDir
  Destination directory for extracted media. Created if missing. Must be
  under the target exam's own public/questions/<exam-id>/... path -- this
  script does not enforce that (it doesn't know which exam you're
  ingesting for), so pass the correct path yourself; see
  references/question-schema.md's "Asset path convention".

.PARAMETER Entries
  Optional explicit list of word/media/* entry names to extract (e.g.
  "media/image7.png"). If omitted, extracts every word/media/* entry found
  in the docx.

.PARAMETER Rename
  Optional hashtable-style mapping (as a JSON string) from source media
  entry name to the destination filename to use, e.g.
  '{"media/image7.png":"q06-triangles-abc-dbc.png"}'. Entries not listed
  keep their original media filename (e.g. "image7.png").

.PARAMETER Force
  Overwrite existing destination files. Without this, an existing file is
  reported and skipped, never silently overwritten.

.EXAMPLE
  .\docx-extract-media.ps1 -DocxPath "tests-source\gat\quantitative\quantitative-1.docx" `
    -OutDir "public\questions\saat\quantitative\test-1" `
    -Entries "media/image2.png","media/image3.png" `
    -Rename '{"media/image2.png":"q01-shaded-circle-sectors.png","media/image3.png":"q02-shaded-square-quadrants.png"}'
#>
param(
  [Parameter(Mandatory = $true)][string]$DocxPath,
  [Parameter(Mandatory = $true)][string]$OutDir,
  [string[]]$Entries,
  [string]$Rename,
  [switch]$Force
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $DocxPath)) {
  throw "DOCX not found: $DocxPath"
}
$DocxPath = (Resolve-Path $DocxPath).Path
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$OutDir = (Resolve-Path $OutDir).Path

$renameMap = @{}
if ($Rename) {
  $parsed = $Rename | ConvertFrom-Json
  $parsed.PSObject.Properties | ForEach-Object { $renameMap[$_.Name] = $_.Value }
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($DocxPath)

$mediaEntries = $zip.Entries | Where-Object { $_.FullName -like "word/media/*" }

# ---- detect referenced-vs-unreferenced media (unused-media detection) ----
$entry = $zip.GetEntry("word/document.xml")
$reader = New-Object System.IO.StreamReader($entry.Open())
$docXml = $reader.ReadToEnd()
$reader.Close()
$relsEntry = $zip.GetEntry("word/_rels/document.xml.rels")
$referencedTargets = @{}
if ($relsEntry) {
  $r = New-Object System.IO.StreamReader($relsEntry.Open())
  $relsXml = $r.ReadToEnd()
  $r.Close()
  $relMap = @{}
  [regex]::Matches($relsXml, '<Relationship Id="([^"]+)"[^>]*Target="([^"]+)"') | ForEach-Object {
    $relMap[$_.Groups[1].Value] = $_.Groups[2].Value
  }
  [regex]::Matches($docXml, 'r:embed="([^"]+)"') | ForEach-Object {
    $rId = $_.Groups[1].Value
    if ($relMap.ContainsKey($rId)) { $referencedTargets["word/" + $relMap[$rId]] = $true }
  }
}

$toExtract = if ($Entries) {
  $mediaEntries | Where-Object { $Entries -contains $_.FullName.Substring(5) }
} else {
  $mediaEntries
}

Write-Host "== Extracting media from $DocxPath =="
foreach ($e in $toExtract) {
  $srcName = $e.FullName  # e.g. word/media/image7.png
  $shortName = $srcName.Substring(11)  # image7.png
  $mediaKey = $srcName.Substring(5)    # media/image7.png (matches -Entries convention)
  $destName = if ($renameMap.ContainsKey($mediaKey)) { $renameMap[$mediaKey] } else { $shortName }
  $destPath = Join-Path $OutDir $destName

  if ((Test-Path $destPath) -and -not $Force) {
    Write-Host "SKIP (exists, use -Force to overwrite): $destPath"
    continue
  }

  $referenced = $referencedTargets.ContainsKey($srcName)
  $tag = if ($referenced) { "" } else { " [UNREFERENCED in document.xml -- verify before extracting]" }

  $stream = $e.Open()
  $outStream = [System.IO.File]::Create($destPath)
  $stream.CopyTo($outStream)
  $outStream.Close()
  $stream.Close()
  Write-Host "WROTE: $destPath  (from $srcName)$tag"
}

Write-Host ""
Write-Host "== Media present in docx but not referenced from document.xml body =="
$mediaEntries | ForEach-Object {
  if (-not $referencedTargets.ContainsKey($_.FullName)) {
    Write-Host "  $($_.FullName)  ($($_.Length) bytes) -- likely unused; do not copy without checking headers/deleted content"
  }
}

$zip.Dispose()
