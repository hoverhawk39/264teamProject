// stdin: PNG bytes; stdout: JSON line blocks. Never persist source drawings.
import Foundation
import Vision
import ImageIO

struct Block: Encodable {
    let text: String
    let x: Double
    let y: Double
    let w: Double
    let h: Double
    let confidence: Float
}
struct Result: Encodable {
    let blocks: [Block]
    let warnings: [String]
}

do {
    let bytes = FileHandle.standardInput.readDataToEndOfFile()
    guard let source = CGImageSourceCreateWithData(bytes as CFData, nil),
          CGImageSourceGetType(source) as String? == "public.png",
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        throw NSError(domain: "OCR", code: 1, userInfo: [NSLocalizedDescriptionKey: "invalid PNG"])
    }
    let width = Double(image.width), height = Double(image.height)
    guard width > 0, height > 0, width * height <= 32_000_000 else {
        throw NSError(domain: "OCR", code: 2, userInfo: [NSLocalizedDescriptionKey: "image dimensions exceed limit"])
    }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    let supported = try request.supportedRecognitionLanguages()
    let languages = ["zh-Hant", "en-US"].filter { supported.contains($0) }
    request.recognitionLanguages = languages.isEmpty ? ["en-US"] : languages
    try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
    let blocks = (request.results ?? []).compactMap { observation -> Block? in
        guard let candidate = observation.topCandidates(1).first else { return nil }
        let rect = observation.boundingBox
        return Block(text: candidate.string,
                     x: rect.minX * width, y: (1 - rect.maxY) * height,
                     w: rect.width * width, h: rect.height * height,
                     confidence: candidate.confidence)
    }.sorted { $0.y == $1.y ? $0.x < $1.x : $0.y < $1.y }
    let warnings = blocks.isEmpty ? ["No text recognized; inspect image resolution and contrast."] : []
    let output = try JSONEncoder().encode(Result(blocks: blocks, warnings: warnings))
    FileHandle.standardOutput.write(output)
} catch {
    FileHandle.standardError.write(Data("OCR failed (invalid image or unavailable Vision model)\n".utf8))
    let code = (error as NSError).domain == "OCR" ? 2 : 1
    exit(Int32(code))
}
