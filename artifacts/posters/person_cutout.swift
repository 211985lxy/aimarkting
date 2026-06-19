import AppKit
import CoreImage
import ImageIO
import UniformTypeIdentifiers
import Vision

let args = CommandLine.arguments
guard args.count == 3 else {
  fputs("Usage: swift person_cutout.swift <input-image> <output-png>\n", stderr)
  exit(2)
}

let inputURL = URL(fileURLWithPath: args[1])
let outputURL = URL(fileURLWithPath: args[2])

guard let source = CIImage(contentsOf: inputURL, options: [.applyOrientationProperty: true]) else {
  fputs("Failed to read input image\n", stderr)
  exit(1)
}

let request = VNGeneratePersonSegmentationRequest()
request.qualityLevel = .accurate
request.outputPixelFormat = kCVPixelFormatType_OneComponent8

let handler = VNImageRequestHandler(ciImage: source, options: [:])
try handler.perform([request])

guard let maskBuffer = request.results?.first?.pixelBuffer else {
  fputs("No person mask generated\n", stderr)
  exit(1)
}

let context = CIContext(options: [.workingColorSpace: NSNull(), .outputColorSpace: NSNull()])
let mask = CIImage(cvPixelBuffer: maskBuffer)
let scaledMask = mask.transformed(by: CGAffineTransform(
  scaleX: source.extent.width / mask.extent.width,
  y: source.extent.height / mask.extent.height
)).cropped(to: source.extent)

let transparent = CIImage(color: .clear).cropped(to: source.extent)
guard let filter = CIFilter(name: "CIBlendWithMask") else {
  fputs("CIBlendWithMask is unavailable\n", stderr)
  exit(1)
}
filter.setValue(source, forKey: kCIInputImageKey)
filter.setValue(transparent, forKey: kCIInputBackgroundImageKey)
filter.setValue(scaledMask, forKey: kCIInputMaskImageKey)

guard let output = filter.outputImage,
      let cgImage = context.createCGImage(output, from: source.extent) else {
  fputs("Failed to render cutout\n", stderr)
  exit(1)
}

guard let destination = CGImageDestinationCreateWithURL(
  outputURL as CFURL,
  UTType.png.identifier as CFString,
  1,
  nil
) else {
  fputs("Failed to create PNG destination\n", stderr)
  exit(1)
}

CGImageDestinationAddImage(destination, cgImage, nil)
guard CGImageDestinationFinalize(destination) else {
  fputs("Failed to write PNG\n", stderr)
  exit(1)
}

print(outputURL.path)
