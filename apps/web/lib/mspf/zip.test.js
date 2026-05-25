import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import { createStoredZipBase64 } from "./zip";
describe("createStoredZipBase64", () => {
    it("serializes data.json into a stored ZIP archive", () => {
        const base64 = createStoredZipBase64([
            {
                name: "data.json",
                content: JSON.stringify({ format: "MSPF", version: "1.0.0" }),
            },
        ]);
        const bytes = Buffer.from(base64, "base64");
        expect(bytes.subarray(0, 4).toString("hex")).toBe("504b0304");
        expect(bytes.includes(Buffer.from("data.json"))).toBe(true);
        expect(bytes.includes(Buffer.from('"MSPF"'))).toBe(true);
        expect(bytes.subarray(bytes.length - 22, bytes.length - 18).toString("hex")).toBe("504b0506");
    });
    it("rejects unsafe file names", () => {
        expect(() => createStoredZipBase64([{ name: "../data.json", content: "{}" }])).toThrow("Unsafe ZIP file name");
    });
});
