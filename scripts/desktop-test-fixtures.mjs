import { createRequire } from "node:module";

// 使用 PPT 解析器已经依赖的 ZIP 库生成自有单页测试文件，不下载第三方文档。
const require = createRequire(import.meta.url);
const parserRequire = createRequire(require.resolve("pptx-preview"));
const JSZip = parserRequire("jszip");

export async function createDesktopPptxFixture() {
  const zip = new JSZip();
  const namespaces = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
  const group = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
  const relationships = (items) => `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.map(([id, type, target]) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`).join("")}</Relationships>`;
  zip.file("[Content_Types].xml", `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${[
    ["presentation", "presentation.main"], ["slides/slide1", "slide"],
    ["slideMasters/slideMaster1", "slideMaster"], ["slideLayouts/slideLayout1", "slideLayout"],
  ].map(([file, type]) => `<Override PartName="/ppt/${file}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.${type}+xml"/>`).join("")}<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/></Types>`);
  zip.file("_rels/.rels", relationships([["rId1", "officeDocument", "ppt/presentation.xml"]]));
  zip.file("ppt/presentation.xml", `<p:presentation ${namespaces}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId2"/></p:sldMasterIdLst><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst><p:sldSz cx="9144000" cy="5143500"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle><a:defPPr><a:defRPr lang="en-US"/></a:defPPr></p:defaultTextStyle></p:presentation>`);
  zip.file("ppt/_rels/presentation.xml.rels", relationships([
    ["rId1", "slide", "slides/slide1.xml"], ["rId2", "slideMaster", "slideMasters/slideMaster1.xml"],
    ["rId3", "theme", "theme/theme1.xml"],
  ]));
  const shape = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="pupu fixture"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="914400" y="914400"/><a:ext cx="6400800" cy="1828800"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="AA2244"/></a:solidFill></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="2400"/><a:t>pupu desktop PPT test</a:t></a:r><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>`;
  zip.file("ppt/slides/slide1.xml", `<p:sld ${namespaces}><p:cSld><p:spTree>${group}${shape}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`);
  zip.file("ppt/slides/_rels/slide1.xml.rels", relationships([["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"]]));
  const colors = '<p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/>';
  zip.file("ppt/slideMasters/slideMaster1.xml", `<p:sldMaster ${namespaces}><p:cSld><p:spTree>${group}</p:spTree></p:cSld>${colors}<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`);
  zip.file("ppt/slideMasters/_rels/slideMaster1.xml.rels", relationships([["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"], ["rId2", "theme", "../theme/theme1.xml"]]));
  zip.file("ppt/slideLayouts/slideLayout1.xml", `<p:sldLayout ${namespaces} type="blank"><p:cSld name="Blank"><p:spTree>${group}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`);
  zip.file("ppt/slideLayouts/_rels/slideLayout1.xml.rels", relationships([["rId1", "slideMaster", "../slideMasters/slideMaster1.xml"]]));
  const colorNames = ["dk1", "lt1", "dk2", "lt2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"];
  zip.file("ppt/theme/theme1.xml", `<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="pupu"><a:themeElements><a:clrScheme name="pupu">${colorNames.map((name, i) => `<a:${name}><a:srgbClr val="${i % 2 ? "FFFFFF" : "224466"}"/></a:${name}>`).join("")}</a:clrScheme><a:fontScheme name="pupu"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="pupu"><a:fillStyleLst/><a:lnStyleLst/><a:effectStyleLst/><a:bgFillStyleLst/></a:fmtScheme></a:themeElements></a:theme>`);
  return zip.generateAsync({ type: "nodebuffer" });
}
