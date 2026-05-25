const TRUE_VALUES = new Set(["1", "true", "yes", "y", "是"]);
function normalizeHeader(value) {
    return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}
function optionalText(value) {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
}
function optionalInt(value) {
    const normalized = optionalText(value);
    if (!normalized) {
        return undefined;
    }
    if (!/^[0-9]+$/.test(normalized)) {
        throw new Error(`CSV numeric field is invalid: ${normalized}`);
    }
    return Number.parseInt(normalized, 10);
}
function optionalBool(value) {
    const normalized = optionalText(value);
    if (!normalized) {
        return undefined;
    }
    return TRUE_VALUES.has(normalized.toLowerCase());
}
export function parseCsvRows(csvText) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    for (let index = 0; index < csvText.length; index += 1) {
        const char = csvText[index];
        const next = csvText[index + 1];
        if (quoted) {
            if (char === "\"" && next === "\"") {
                field += "\"";
                index += 1;
            }
            else if (char === "\"") {
                quoted = false;
            }
            else {
                field += char;
            }
            continue;
        }
        if (char === "\"") {
            quoted = true;
        }
        else if (char === ",") {
            row.push(field);
            field = "";
        }
        else if (char === "\n") {
            row.push(field);
            rows.push(row);
            row = [];
            field = "";
        }
        else if (char !== "\r") {
            field += char;
        }
    }
    row.push(field);
    rows.push(row);
    return rows.filter((candidate) => candidate.some((cell) => cell.trim().length > 0));
}
export function genericCsvToImportPayload(csvText, sourceFileName) {
    const rows = parseCsvRows(csvText);
    if (rows.length < 2) {
        throw new Error("CSV must include a header row and at least one data row.");
    }
    const headers = rows[0].map(normalizeHeader);
    const titleIndex = headers.findIndex((header) => ["canonical_title", "title", "name"].includes(header));
    if (titleIndex < 0) {
        throw new Error("CSV requires a canonical_title or title column.");
    }
    const items = rows.slice(1).map((row, rowIndex) => {
        const record = new Map();
        headers.forEach((header, index) => {
            record.set(header, row[index] ?? "");
        });
        const title = optionalText(record.get("canonical_title")) ?? optionalText(record.get("title"));
        if (!title) {
            throw new Error(`CSV row ${rowIndex + 2} is missing a title.`);
        }
        const mediaType = optionalText(record.get("media_type")) ?? "book";
        if (mediaType !== "book" && mediaType !== "movie") {
            throw new Error(`CSV row ${rowIndex + 2} has unsupported media_type: ${mediaType}`);
        }
        const externalSource = optionalText(record.get("external_source"));
        const externalId = optionalText(record.get("external_id"));
        if ((externalSource && !externalId) || (!externalSource && externalId)) {
            throw new Error(`CSV row ${rowIndex + 2} must provide external_source and external_id together.`);
        }
        return {
            media_type: mediaType,
            canonical_title: title,
            original_title: optionalText(record.get("original_title")),
            first_release_year: optionalInt(record.get("first_release_year") ?? record.get("year")),
            original_language: optionalText(record.get("original_language") ?? record.get("language")),
            cover_url: optionalText(record.get("cover_url")),
            edition_title: optionalText(record.get("edition_title")),
            edition_language: optionalText(record.get("edition_language")),
            edition_type: optionalText(record.get("edition_type")),
            page_count: optionalInt(record.get("page_count")),
            runtime_minutes: optionalInt(record.get("runtime_minutes")),
            status: optionalText(record.get("status")) ?? (mediaType === "movie" ? "watched" : "want_to_read"),
            rating_x10: optionalInt(record.get("rating_x10")),
            favorite: optionalBool(record.get("favorite")),
            visibility_scope: optionalText(record.get("visibility_scope")) ?? "private",
            started_at: optionalText(record.get("started_at")),
            finished_at: optionalText(record.get("finished_at")),
            external_ids: externalSource && externalId
                ? [
                    {
                        source: externalSource,
                        external_id: externalId,
                        source_url: optionalText(record.get("source_url")),
                    },
                ]
                : [],
        };
    });
    return {
        source: "csv",
        source_file_name: sourceFileName,
        items,
    };
}
