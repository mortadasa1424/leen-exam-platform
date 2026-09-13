<#
.SYNOPSIS
  Phase A (inspect) helper for /ingest-questions. Deterministically unzips a
  .docx (OpenXML package) and surfaces its raw structure -- it does NOT
  interpret question boundaries, categories, or editorial markings; that is
  semantic work for Claude to do by reading the extracted files this script
  produces. See references/docx-ingestion.md.

.DESCRIPTION
  Zero-dependency: uses .NET's built-in System.IO.Compression.ZipFile, which
  opens a .docx directly (a docx IS a zip; no rename needed). Does not
  require npm install or any project dependency.

  Extracts, into -OutDir:
    document.xml          word/document.xml, as readable text
    document.xml.rels     word/_rels/document.xml.rels, as readable text
    comments.xml          word/comments.xml, if present
    omml-blocks.txt       every <m:oMath>...</m:oMath> block, numbered,
                           in document order -- the input to OMML->LaTeX
                           conversion
    media-order.txt       the r:embed="rIdN" sequence as it appears in
                           document.xml (reading order), each resolved to
                           its target media file via the rels file -- this
                           is what lets you correlate "3rd image in
                           reading order" to whatever Word happened to
                           call it (image7.png etc.)
    summary.txt            structural counts + distinct style/color names

.PARAMETER DocxPath
  Path to the source .docx file.

.PARAMETER OutDir
  Where to write extracted files. Defaults to a per-file folder under the
  OS temp directory (never inside the repo, so nothing here needs a
  .gitignore entry or manual cleanup before committing).

.EXAMPLE
  .\docx-inspect.ps1 -DocxPath "tests-source\gat\quantitative\quantitative-1.docx"
#>
param(
  [Parameter(Mandatory = $true)][string]$DocxPath,
  [string]$OutDir
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $DocxPath)) {
  throw "DOCX not found: $DocxPath"
}
$DocxPath = (Resolve-Path $DocxPath).Path

if (-not $OutDir) {
  $base = [System.IO.Path]::GetFileNameWithoutExtension($DocxPath)
  $OutDir = Join-Path $env:TEMP "ingest-questions\$base"
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($DocxPath)

function Get-ZipEntryText($zip, $entryName) {
  $entry = $zip.GetEntry($entryName)
  if (-not $entry) { return $null }
  $reader = New-Object System.IO.StreamReader($entry.Open())
  try { return $reader.ReadToEnd() } finally { $reader.Close() }
}

Write-Host "== ZIP entries =="
$entries = $zip.Entries | Sort-Object FullName
$entries | ForEach-Object { "{0,10}  {1}" -f $_.Length, $_.FullName } | Write-Host

$docXml = Get-ZipEntryText $zip "word/document.xml"
if (-not $docXml) { throw "word/document.xml not found - is this a valid .docx?" }
$relsXml = Get-ZipEntryText $zip "word/_rels/document.xml.rels"
$commentsXml = Get-ZipEntryText $zip "word/comments.xml"

$docXml       | Out-File -FilePath (Join-Path $OutDir "document.xml") -Encoding utf8
if ($relsXml) { $relsXml | Out-File -FilePath (Join-Path $OutDir "document.xml.rels") -Encoding utf8 }
if ($commentsXml) { $commentsXml | Out-File -FilePath (Join-Path $OutDir "comments.xml") -Encoding utf8 }

# ---- OMML blocks, in document order ----
$ommlMatches = [regex]::Matches($docXml, '<m:oMath>.*?</m:oMath>', [System.Text.RegularExpressions.RegexOptions]::Singleline)
$ommlOut = New-Object System.Text.StringBuilder
for ($i = 0; $i -lt $ommlMatches.Count; $i++) {
  [void]$ommlOut.AppendLine("----- OMML #$($i+1) -----")
  [void]$ommlOut.AppendLine($ommlMatches[$i].Value)
  [void]$ommlOut.AppendLine("")
}
$ommlOut.ToString() | Out-File -FilePath (Join-Path $OutDir "omml-blocks.txt") -Encoding utf8

# ---- image reading order -> target file, via rels ----
$relMap = @{}
if ($relsXml) {
  [regex]::Matches($relsXml, '<Relationship Id="([^"]+)"[^>]*Target="([^"]+)"') | ForEach-Object {
    $relMap[$_.Groups[1].Value] = $_.Groups[2].Value
  }
}
$embedMatches = [regex]::Matches($docXml, 'r:embed="([^"]+)"')
$mediaOrder = New-Object System.Text.StringBuilder
$seq = 0
foreach ($m in $embedMatches) {
  $seq++
  $rId = $m.Groups[1].Value
  $target = $relMap[$rId]
  [void]$mediaOrder.AppendLine("$seq`t$rId`t$target")
}
$mediaOrder.ToString() | Out-File -FilePath (Join-Path $OutDir "media-order.txt") -Encoding utf8

# ---- structural summary ----
function Count-Matches($pattern, $text) {
  if (-not $text) { return 0 }
  return [regex]::Matches($text, $pattern).Count
}
$pStyles = [regex]::Matches($docXml, 'w:pStyle w:val="([^"]+)"') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
$colors  = [regex]::Matches($docXml, 'w:color w:val="([0-9A-Fa-f]{6})"') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
$hasStrike = $docXml -match '<w:strike'
$hasHighlight = $docXml -match '<w:highlight'
$hasComments = [bool]$commentsXml
$distinctEmbedCount = ($embedMatches | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique | Measure-Object).Count
$mediaFileCount = ($entries | Where-Object { $_.FullName -like 'word/media/*' } | Measure-Object).Count

$summaryLines = @(
  "Source:             $DocxPath"
  "Extracted to:       $OutDir"
  ""
  "Paragraphs (<w:p>): $(Count-Matches '<w:p[ >]' $docXml)"
  "Tables (<w:tbl>):   $(Count-Matches '<w:tbl>' $docXml)"
  "OMML nodes:         $($ommlMatches.Count)"
  "Drawings/images:    $(Count-Matches '<w:drawing>' $docXml)"
  "Distinct r:embed:   $distinctEmbedCount"
  "Media files (zip):  $mediaFileCount"
  ""
  "Distinct w:pStyle names in use (check these against docx-ingestion.md's"
  "boundary-detection notes -- do NOT assume they mean the same thing as"
  "GAT's source files unless you verify the surrounding content):"
  ($pStyles -join "`n")
  ""
  "Distinct w:color values in use (hex, no '#'):"
  ($colors -join ", ")
  ""
  "Has <w:strike> anywhere:     $hasStrike"
  "Has <w:highlight> anywhere:  $hasHighlight"
  "Has word/comments.xml:       $hasComments"
  ""
  "Files written:"
  "  document.xml        - full body markup, read/grep this directly"
  "  document.xml.rels   - rId -> target part map"
  "  omml-blocks.txt     - every OMML block, numbered, in document order"
  "  media-order.txt     - reading-order sequence: seq, rId, target media file"
  "  comments.xml        - only if the source has Word comments"
)
$summary = $summaryLines -join "`n"

$summary | Out-File -FilePath (Join-Path $OutDir "summary.txt") -Encoding utf8
Write-Host ""
Write-Host $summary

$zip.Dispose()
