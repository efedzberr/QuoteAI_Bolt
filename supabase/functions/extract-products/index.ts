import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  console.log("=== REQUEST RECEIVED ===");
  console.log("Method:", req.method);
  console.log("URL:", req.url);
  console.log("Headers:", Object.fromEntries(req.headers));

  if (req.method === "OPTIONS") {
    console.log("Handling OPTIONS request");
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    let text: string;
    let sourceType: string;

    let body;
    try {
      const rawBody = await req.text();
      console.log("Raw body length:", rawBody.length);
      console.log("Raw body preview:", rawBody.substring(0, 200));
      body = JSON.parse(rawBody);
      console.log("Request body parsed, keys:", Object.keys(body));
      console.log("text field present:", "text" in body);
      console.log("sourceType field present:", "sourceType" in body);
      if ("text" in body) {
        console.log("text length:", String(body.text).length);
      }
      text = body.text;
      sourceType = body.sourceType;
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr);
      console.error("Error details:", parseErr instanceof Error ? parseErr.message : String(parseErr));
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body", details: String(parseErr) }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey || apiKey.trim().length === 0) {
      console.error("ANTHROPIC_API_KEY not found in environment");
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const systemPrompt = `You are a procurement specialist extracting products from invoices, quotes, purchase orders, and product lists in Spanish.

CRITICAL RULES:
1. Extract ONLY product line items — rows that represent actual products, materials, or items to be purchased/sold
2. HEADER DETECTION: The document may or may not have a header row. If the first row looks like column names (e.g., "Descripcion", "Cantidad", "Producto", "Articulo", "Unidad"), skip it. If the first row looks like an actual product (e.g., a product code, part number, or product description), include it — DO NOT skip it.
3. Each row with product data must be included, including the first row if it is a product
4. Ignore: footers, subtotals, totals, taxes, IVA, transport charges, payment terms, dates, signatures, company info
5. Each product MUST have a description
6. Extract quantities exactly as shown. If no quantity is found or the value is 0, default to 1
7. If no unit is found, use "PZ" (piezas)
8. Never create or invent products not present in the document
9. Preserve original descriptions exactly as written
10. For handwritten lists: read carefully and extract every item listed
11. For tab-separated or CSV-like text: treat each row as a separate product line
12. PRODUCT CODE EXTRACTION: If the document has a column with product codes, SKUs, part numbers, or item references (column headers like 'Codigo', 'Clave', 'SKU', 'CodigoArt', 'No. Parte', 'Cve', 'Referencia', 'Item', 'Ref'), extract that code into the 'Codigo' field of each row. If no code is present for a row, set 'Codigo' to an empty string. NEVER invent or guess product codes — only extract what is explicitly written in the document.

RETURN FORMAT — ONLY a valid JSON array, NO markdown, NO backticks, NO explanation:

[
  {
    "Codigo": "exact product code as written, or empty string if absent",
    "Descripcion": "exact product description",
    "Cantidad": number_value,
    "Unidad": "unit abbreviation"
  }
]

WHAT TO IGNORE:
- "Subtotal", "IVA", "Total", "TOTAL", "Gran Total"
- "Documento generado", "Fecha", "Referencia", "Folio"
- "Condiciones de pago", "Transporte", "Agente", "Vendedor"
- Rows with only numeric totals or calculations
- Company name, address, RFC, contact info

IMPORTANT: When in doubt about whether a row is a product or a header, include it as a product. It is better to include an extra row than to miss a real product.`;

    let messageContent: any;

    if (body.imageBase64 && body.mediaType) {
      messageContent = [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: body.mediaType,
            data: body.imageBase64,
          },
        },
        {
          type: "text",
          text: "Extract all product line items from this image. This may be a photo of a spreadsheet, a printed form, or a handwritten list. Be thorough and extract every product row you can read.",
        },
      ];
    } else {
      if (!text || typeof text !== "string") {
        return new Response(
          JSON.stringify({ error: "No text or image provided" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      messageContent = `Extract all product line items from this ${sourceType} document. Be thorough and extract every product row:\n\n${text.substring(0, 80000)}`;
    }

    const requestBody = JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: messageContent,
        },
      ],
    });

    let data: any;
    let response: Response;
    const maxRetries = 4;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: requestBody,
      });

      data = await response.json();

      if (response.ok) break;

      const isOverloaded =
        response.status === 529 ||
        (data?.error?.type === "overloaded_error") ||
        (typeof data?.error?.message === "string" &&
          data.error.message.toLowerCase().includes("overload"));

      if (isOverloaded && attempt < maxRetries) {
        const waitMs = Math.pow(2, attempt) * 2000;
        console.log(`Anthropic overloaded, retrying in ${waitMs}ms (attempt ${attempt + 1})`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }

      console.error("Anthropic API error:", data);
      return new Response(
        JSON.stringify({
          error: "Failed to process document",
          details: data.error?.message,
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!response!.ok) {
      return new Response(
        JSON.stringify({
          error: "Failed to process document after retries",
          details: data?.error?.message,
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const content = data.content?.[0]?.text || "[]";

    let clean = content
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .replace(/`/g, "")
      .trim();

    if (clean.startsWith("[")) {
      const lastBracket = clean.lastIndexOf("]");
      if (lastBracket !== -1) {
        clean = clean.substring(0, lastBracket + 1);
      }
    }

    const tryParse = (s: string): any[] | null => {
      try {
        const v = JSON.parse(s);
        return Array.isArray(v) ? v : null;
      } catch {
        return null;
      }
    };

    let extractedRows: any[] =
      tryParse(clean) ??
      tryParse(
        clean.replace(/[\n\r]/g, " ").replace(/,\s*]/g, "]").replace(/,\s*}/g, "}")
      ) ??
      (clean.trim().startsWith("[") && clean.lastIndexOf("}") !== -1
        ? tryParse(clean.substring(0, clean.lastIndexOf("}") + 1) + "]")
        : null) ??
      [];

    if (!Array.isArray(extractedRows) || extractedRows.length === 0) {
      return new Response(
        JSON.stringify({ error: "No products found in document", data: [] }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const validRows = extractedRows.filter((row: any) => {
      const hasDescription =
        row.Descripcion &&
        typeof row.Descripcion === "string" &&
        row.Descripcion.trim().length > 0;
      return hasDescription;
    });

    const formattedRows = validRows.map((row: any, index: number) => {
      let cantidad: number = 1;
      if (row.Cantidad !== undefined && row.Cantidad !== null) {
        const rawCant = row.Cantidad;
        const num =
          typeof rawCant === "number"
            ? rawCant
            : parseFloat(String(rawCant).replace(",", "."));
        if (isFinite(num) && num > 0) {
          cantidad = num;
        }
      }

      return {
        "IEST-01": String(index + 1),
        Codigo: String(row.Codigo || "").trim(),
        Descripcion: String(row.Descripcion).trim(),
        Unid: String(row.Unidad || "PZ").trim().substring(0, 10),
        Cant: String(cantidad),
      };
    });

    return new Response(JSON.stringify({ data: formattedRows }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Unhandled error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
