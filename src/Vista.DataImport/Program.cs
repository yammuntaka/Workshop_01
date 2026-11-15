using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Web.Script.Serialization;
using System.Xml;

namespace Vista.DataImport
{
    internal static class Program
    {
        private static int Main(string[] args)
        {
            if (args.Length != 2)
            {
                Console.Error.WriteLine("Usage: VistaDataImport.exe <workbook.xlsx> <output.json>");
                return 1;
            }

            List<Product> products = ReadProducts(args[0]);
            string outputPath = Path.GetFullPath(args[1]);
            Directory.CreateDirectory(Path.GetDirectoryName(outputPath));
            var serializer = new JavaScriptSerializer();
            serializer.MaxJsonLength = int.MaxValue;
            var catalog = new ProductCatalog
            {
                SourceFile = Path.GetFileName(args[0]),
                Products = products
            };
            File.WriteAllText(outputPath, serializer.Serialize(catalog), new UTF8Encoding(false));
            Console.WriteLine("Imported " + products.Count + " SKUs to " + outputPath);
            return 0;
        }

        private static List<Product> ReadProducts(string workbookPath)
        {
            using (ZipArchive archive = ZipFile.OpenRead(workbookPath))
            {
                XmlDocument sharedDocument = ReadXml(archive, "xl/sharedStrings.xml");
                XmlDocument sheetDocument = ReadXml(archive, "xl/worksheets/sheet1.xml");
                string namespaceUri = sheetDocument.DocumentElement.NamespaceURI;
                var sharedStrings = ReadSharedStrings(sharedDocument);
                XmlNodeList rows = sheetDocument.GetElementsByTagName("row", namespaceUri);
                if (rows.Count < 2)
                {
                    throw new InvalidDataException("The workbook does not contain product rows.");
                }

                Dictionary<string, string> columns = ReadColumns(rows[0] as XmlElement, sharedStrings);
                string[] requiredColumns =
                {
                    "Product ID", "Product SKU Name", "Material Number SAP", "Product Category",
                    "Family", "Development Status (SKU)", "Launch", "Initial SDQ", "Latest SDQ",
                    "SSQ Estimation", "Latest SSQ", "Year", "Season Type"
                };
                foreach (string column in requiredColumns)
                {
                    if (!columns.ContainsKey(column))
                    {
                        throw new InvalidDataException("Required workbook column was not found: " + column);
                    }
                }

                var products = new List<Product>();
                for (int rowIndex = 1; rowIndex < rows.Count; rowIndex++)
                {
                    XmlElement row = rows[rowIndex] as XmlElement;
                    Dictionary<string, string> values = ReadRow(row, sharedStrings);
                    string productId = GetValue(values, columns, "Product ID");
                    if (string.IsNullOrWhiteSpace(productId))
                    {
                        continue;
                    }

                    products.Add(new Product
                    {
                        ProductId = productId,
                        SkuName = GetValue(values, columns, "Product SKU Name"),
                        MaterialNumber = GetValue(values, columns, "Material Number SAP"),
                        Category = GetValue(values, columns, "Product Category"),
                        Family = GetValue(values, columns, "Family"),
                        DevelopmentStatus = GetValue(values, columns, "Development Status (SKU)"),
                        Launch = GetValue(values, columns, "Launch"),
                        Year = GetValue(values, columns, "Year"),
                        SeasonType = GetValue(values, columns, "Season Type"),
                        InitialSdq = GetNumber(values, columns, "Initial SDQ"),
                        LatestSdq = GetNumber(values, columns, "Latest SDQ"),
                        SsqEstimation = GetNumber(values, columns, "SSQ Estimation"),
                        LatestSsq = GetNumber(values, columns, "Latest SSQ")
                    });
                }

                if (products.Count == 0)
                {
                    throw new InvalidDataException("No products were found in the workbook.");
                }

                return products;
            }
        }

        private static XmlDocument ReadXml(ZipArchive archive, string entryName)
        {
            ZipArchiveEntry entry = archive.GetEntry(entryName);
            if (entry == null)
            {
                throw new InvalidDataException("Workbook entry was not found: " + entryName);
            }

            var document = new XmlDocument();
            using (Stream stream = entry.Open())
            {
                document.Load(stream);
            }
            return document;
        }

        private static List<string> ReadSharedStrings(XmlDocument document)
        {
            var values = new List<string>();
            foreach (XmlNode item in document.GetElementsByTagName("si", document.DocumentElement.NamespaceURI))
            {
                var text = new StringBuilder();
                foreach (XmlNode node in item.SelectNodes(".//*[local-name()='t']"))
                {
                    text.Append(node.InnerText);
                }
                values.Add(text.ToString());
            }
            return values;
        }

        private static Dictionary<string, string> ReadColumns(XmlElement headerRow, List<string> sharedStrings)
        {
            var columns = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (XmlNode node in headerRow.ChildNodes)
            {
                XmlElement cell = node as XmlElement;
                if (cell == null || cell.LocalName != "c")
                {
                    continue;
                }

                string name = ReadCellValue(cell, sharedStrings);
                if (!string.IsNullOrWhiteSpace(name))
                {
                    columns[name] = GetColumnName(cell.GetAttribute("r"));
                }
            }
            return columns;
        }

        private static Dictionary<string, string> ReadRow(XmlElement row, List<string> sharedStrings)
        {
            var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (XmlNode node in row.ChildNodes)
            {
                XmlElement cell = node as XmlElement;
                if (cell != null && cell.LocalName == "c")
                {
                    values[GetColumnName(cell.GetAttribute("r"))] = ReadCellValue(cell, sharedStrings);
                }
            }
            return values;
        }

        private static string ReadCellValue(XmlElement cell, List<string> sharedStrings)
        {
            XmlNode valueNode = cell.SelectSingleNode("./*[local-name()='v']");
            if (cell.GetAttribute("t") == "s" && valueNode != null)
            {
                int index = int.Parse(valueNode.InnerText, CultureInfo.InvariantCulture);
                if (index < 0 || index >= sharedStrings.Count)
                {
                    throw new InvalidDataException("Invalid shared string index in workbook.");
                }
                return sharedStrings[index];
            }

            if (cell.GetAttribute("t") == "inlineStr")
            {
                var text = new StringBuilder();
                foreach (XmlNode node in cell.SelectNodes(".//*[local-name()='t']"))
                {
                    text.Append(node.InnerText);
                }
                return text.ToString();
            }

            return valueNode == null ? string.Empty : valueNode.InnerText;
        }

        private static string GetColumnName(string cellReference)
        {
            var columnName = new StringBuilder();
            foreach (char character in cellReference)
            {
                if (character < 'A' || character > 'Z')
                {
                    break;
                }
                columnName.Append(character);
            }
            return columnName.ToString();
        }

        private static string GetValue(Dictionary<string, string> values, Dictionary<string, string> columns, string name)
        {
            string column = columns[name];
            string value;
            return values.TryGetValue(column, out value) ? value : string.Empty;
        }

        private static decimal? GetNumber(Dictionary<string, string> values, Dictionary<string, string> columns, string name)
        {
            string value = GetValue(values, columns, name);
            decimal number;
            return decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out number)
                ? (decimal?)number
                : null;
        }
    }

    internal sealed class Product
    {
        public string ProductId { get; set; }
        public string SkuName { get; set; }
        public string MaterialNumber { get; set; }
        public string Category { get; set; }
        public string Family { get; set; }
        public string DevelopmentStatus { get; set; }
        public string Launch { get; set; }
        public string Year { get; set; }
        public string SeasonType { get; set; }
        public decimal? InitialSdq { get; set; }
        public decimal? LatestSdq { get; set; }
        public decimal? SsqEstimation { get; set; }
        public decimal? LatestSsq { get; set; }
    }

    internal sealed class ProductCatalog
    {
        public string SourceFile { get; set; }
        public List<Product> Products { get; set; }
    }
}
