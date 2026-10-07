import AppKit

let image = NSImage(size: NSSize(width: 840, height: 160))
image.lockFocus()
NSColor.white.setFill()
NSRect(x: 0, y: 0, width: 840, height: 160).fill()
("EJECTOR PIN  12.50 mm" as NSString).draw(
    at: NSPoint(x: 45, y: 65),
    withAttributes: [.font: NSFont.systemFont(ofSize: 39), .foregroundColor: NSColor.black]
)
("頂針" as NSString).draw(
    at: NSPoint(x: 45, y: 12),
    withAttributes: [.font: NSFont.systemFont(ofSize: 39), .foregroundColor: NSColor.black]
)
image.unlockFocus()
let bitmap = NSBitmapImageRep(data: image.tiffRepresentation!)!
FileHandle.standardOutput.write(bitmap.representation(using: .png, properties: [:])!)
