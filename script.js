// script.js

let categoryColors = {};
let jsonData = {};

fetch("qlik_cloud_learning_structure.json")
  .then((response) => response.json())
  .then((data) => {
    jsonData = data; // Store full JSON data for description lookup

    categoryColors = {};
    categoryColors[data.name || "ODAG"] = data.color;

    createLegend();
    drawVisualization(jsonData);
  })
  .catch((error) => console.error("Error loading JSON:", error));

function transformData(data) {
  const root = { name: "Qlik Cloud Learning", children: [] };

  Object.keys(data).forEach((category) => {
    if (category === "Description") return; // Ignore description at root level

    const categoryNode = {
      name: category,
      children: [],
      color: data[category]["Color"],
    };

    Object.keys(data[category]).forEach((key) => {
      if (key === "Color" || key === "Description") return; // Ignore description and color keys

      let subCategoryNode = {
        name: key,
        children: [],
        color: "#d3d3d3",
      };

      categoryNode.children.push(subCategoryNode);
    });

    root.children.push(categoryNode);
  });

  return root;
}

function drawVisualization(data) {
  const width = 1000;
  const height = 800;

  const svg = d3
    .select("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const tooltip = d3.select(".tooltip");

  const root = d3
    .hierarchy(data)
    .sum((d) => (d.children ? 30 : 10))
    .sort((a, b) => {
      if (!a.parent || !b.parent) return 0;
      return a.parent.children.indexOf(a) - a.parent.children.indexOf(b);
    });

  const pack = d3
    .pack()
    .size([width - 50, height - 50])
    .padding(5);

  pack(root);

  // Manually grid layout for Resources node children
  root.children.forEach((child) => {
    if (child.data.name === "Resources" && child.children) {
      const gridCols = 3;
      const gridSpacing = 110;
      const radius = 35;

      child.children.forEach((c, i) => {
        const col = i % gridCols;
        const row = Math.floor(i / gridCols);
        c.r = radius;
        c.x = child.x - gridSpacing + col * gridSpacing;
        c.y = child.y - gridSpacing + row * gridSpacing;
      });
    }
  });

  const nodes = svg
    .append("g")
    .attr("transform", "translate(25, 25)")
    .selectAll("g")
    .data(root.descendants())
    .enter()
    .append("g")
    .attr("transform", (d) => `translate(${d.x},${d.y})`);

  nodes
    .append("circle")
    .attr("r", (d) => d.r)
    .attr("class", (d) => (d.data.name === "Resources" ? "" : "node"))
    .attr("fill", (d) =>
      d.depth === 0 ? d.data.color : d.data.color || "#d3d3d3"
    )
    .attr("data-name", (d) => d.data.name)

    .on("mouseover", function (event, d) {
      if (d.data.name === "Resources") return;

      d3.select(this)
        .transition()
        .duration(200)
        .attr("stroke", (d) => (d.data.name === "Resources" ? "none" : "#ddd"))
        .attr("stroke-width", 3)
        .attr("r", d.r * 1.1);

      tooltip
        .style("display", "block")
        .html(`<strong>${d.data.name}</strong>`)
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 20 + "px");
    })
    .on("mouseout", function (event, d) {
      if (d.data.name === "Resources") return;

      d3.select(this)
        .transition()
        .duration(200)
        .attr("stroke", "#ddd")
        .attr("stroke-width", 2)
        .attr("r", d.r);

      tooltip.style("display", "none");
    })
    .on("click", function (event, d) {
      // Disable click for 'Resources' node
      if (d.data.name === "Resources") return;
      // Clear previous selection
      d3.selectAll("circle").classed("selected-node", false);
      // If this is a non-leaf node (like ODAG, Implementation, Best Practices), highlight it
      // Highlight ODAG, Implementation, or Best Practices (depth 0 or 1)
      if (d.depth === 0 || d.depth === 1) {
        d3.select(this).classed("selected-node", true);
        // Show the description in the panel
        showDescription(d.data.name, jsonData);
        return;
      }
      // Leaf node with a URL
      if (!d.children && d.data.url) {
        window.open(d.data.url, "_blank");
        return;
      }
    });

  // Ensure tooltip stays active when hovered
  tooltip
    .on("mouseover", function () {
      tooltip.style("display", "block");
    })
    .on("mouseout", function () {
      tooltip.style("display", "none");
    });

  // Labels inside root (ODAG) and leaf (depth 2) nodes
  nodes
    .filter((d) => d.depth === 2)
    .append("text")
    .attr("class", "label")
    .attr("x", 0)
    .attr("dy", (d) => (d.depth === 0 ? -d.r + 20 : 4))
    .style("font-size", (d) =>
      d.depth === 0 ? "16px" : d.r > 40 ? "12px" : "10px"
    )
    .style("font-weight", (d) => (d.depth === 0 ? "bold" : "normal"))
    .text((d) => {
      if (d.data.name.length > 22) {
        return d.data.name.slice(0, 20) + "...";
      }
      return d.data.name;
    });

  // Arc-style labels for first-level category nodes like Resources, Implementation, etc.
  nodes
    .filter((d) => d.depth === 0 || d.depth === 1)
    .append("text")
    .attr("class", "label")
    .attr("x", 0)
    .attr("y", (d) => -d.r + 20) // positioned slightly below the arc
    .style("text-anchor", "middle")
    .style("font-size", "11px")
    .style("font-weight", "bold")
    .text((d) => d.data.name);

  // 🔍 **Search Functionality**
  document.getElementById("searchInput").addEventListener("input", function () {
    const searchTerm = this.value.toLowerCase();

    nodes
      .selectAll("circle")
      .classed(
        "highlight",
        (d) => searchTerm && d.data.name.toLowerCase().includes(searchTerm)
      )
      .classed(
        "dimmed",
        (d) => searchTerm && !d.data.name.toLowerCase().includes(searchTerm)
      );

    nodes
      .selectAll("text")
      .style("font-weight", (d) =>
        searchTerm && d.data.name.toLowerCase().includes(searchTerm)
          ? "bold"
          : "normal"
      );
  });
}

function showDescription(topicName, jsonData) {
  const descriptionPanel = document.getElementById("descriptionPanel");
  const descriptionTitle = document.getElementById("descriptionTitle");
  const descriptionText = document.getElementById("descriptionText");
  const vizContainer = document.querySelector(".visualization-container");

  let description = "No description available.";

  // Updated description for Implementation
  if (topicName === "ODAG") {
    description =
      "On-Demand App Generation (ODAG) allows users to generate smaller, optimized applications dynamically from a large dataset, improving performance while ensuring detailed analysis only when needed.";
  } else if (topicName === "Implementation") {
    description = `<p>Implementing <strong>On-Demand App Generation (ODAG)</strong> in Qlik Cloud enables users to explore large datasets efficiently by generating smaller, purpose-built apps based on specific selections. This reduces system load and enhances performance, especially when working with big data sources.</p>
                      <h4>Key Steps in ODAG Implementation</h4>
                      <ol>
                        <li><strong>Create a Selection App</strong><br/>
                            This is a lightweight app connected to your large data source. It provides filters or selection options to the user (e.g., choose a Region, Year, Product). It should not load detailed data, only metadata or summarized data to aid selection.
                        </li>
                        <li><strong>Create a Template App</strong><br/>
                            This app contains the detailed charts, KPIs, and scripts meant for deep-dive analysis. It is parameterized using ODAG binding fields like <code>$(odag_FIELDNAME)</code>, which will be replaced during generation.
                        </li>
                        <li><strong>Set Up ODAG Link in Qlik Cloud</strong><br/>
                            Go to ODAG Links section in the Qlik Management Console (QMC) or App settings. Create a new ODAG link:
                            <ul>
                              <li>Source: Selection App</li>
                              <li>Target: Template App</li>
                              <li>Bind fields between the two (e.g., Region → <code>odag_REGION</code>)</li>
                            </ul>
                        </li>
                        <li><strong>Use ODAG API or UI Integration (Optional)</strong><br/>
                            You can call ODAG programmatically using REST APIs. Integrate ODAG flows into mashups or portals using the Qlik Capability APIs.
                        </li>
                        <li><strong>Test and Validate</strong><br/>
                            Ensure parameter values from the selection app are passed correctly. Check the script in the template app successfully pulls filtered data. Validate performance, access control, and data consistency.
                        </li>
                      </ol>
                      <h4>Basic Example: Sales Analysis</h4>
                      <p><strong>Use Case:</strong> A user wants to analyze sales for a specific region and year.</p>
                      <ul>
                        <li><strong>Selection App:</strong> Fields: Region, Year<br/>
                          User selects <code>Region = "West"</code> and <code>Year = 2023</code>
                        </li>
                        <li><strong>Template App Load Script:</strong></li>
                      </ul>
                      <pre><code>LOAD *  
                      FROM [lib://Data/Sales.qvd]  
                      WHERE Region = '$(odag_REGION)' AND Year = $(odag_YEAR);</code></pre>
                      <ul>
                        <li><strong>ODAG Link Binding:</strong>
                          <ul>
                            <li>Region → <code>odag_REGION</code></li>
                            <li>Year → <code>odag_YEAR</code></li>
                          </ul>
                        </li>
                        <li><strong>Result:</strong> When the user clicks “Generate App,” a new app is created with only sales data for West region in 2023, speeding up performance and reducing memory usage.</li>
                      </ul>`;
  } else if (topicName === "Best Practices for ODAG in Qlik Cloud") {
    description = `<p>When using <strong>On-Demand App Generation (ODAG)</strong> in Qlik Cloud, adhering to best practices ensures optimal performance, maintainability, and a better user experience.</p>
                      <h4>Best Practices:</h4>
                      <ol>
                        <li><strong>Design Efficient Selection Apps</strong><br/>
                            Keep selection apps lightweight; avoid loading large volumes of data. Use aggregated or summarized views to guide user selections effectively.
                        </li>
                        <li><strong>Use Clear and Meaningful Bind Fields</strong><br/>
                            Name ODAG bind fields clearly (e.g., <code>odag_REGION</code>, <code>odag_YEAR</code>) to improve script readability and reduce confusion during mapping.
                        </li>
                        <li><strong>Optimize Template App Load Scripts</strong><br/>
                            Validate and sanitize user input in the load script using default values or validation logic. Limit the number of rows fetched in the template app using <code>WHERE</code> clauses and conditions.
                        </li>
                        <li><strong>Monitor App Generation and Resource Usage</strong><br/>
                            Use Qlik Cloud monitoring tools to track ODAG app generation requests and ensure resource limits are not exceeded. Archive or delete ODAG-generated apps periodically to maintain a clean workspace.
                        </li>
                        <li><strong>Control Access and Permissions</strong><br/>
                            Secure both selection and template apps using section access and space-level permissions. Restrict ODAG link visibility to relevant user groups only.
                        </li>
                        <li><strong>Test with Real User Scenarios</strong><br/>
                            Simulate real user selections to verify the flow and confirm the generated apps contain expected results.
                        </li>
                        <li><strong>Use Logging and Error Handling</strong><br/>
                            Add logging statements or debugging output to your load scripts to track parameter values and script execution flow.
                        </li>
                      </ol>
                      <p>By following these best practices, organizations can make the most out of ODAG’s powerful capabilities while ensuring performance and governance across their Qlik Cloud environment.</p>`;
  }

  descriptionTitle.innerText = topicName;
  descriptionText.innerHTML = description;
  descriptionPanel.classList.add("show");
  vizContainer.classList.add("shrink");
}

function resetVisualization() {
  d3.selectAll(".node").classed("selected-node", false);
  document.getElementById("descriptionPanel").classList.remove("show");
  document.querySelector(".visualization-container").classList.remove("shrink");
}

function clearSearch() {
  document.getElementById("searchInput").value = "";
  updateSearch("");
}

function updateSearch(searchTerm) {
  const nodes = d3.select("svg").selectAll("g");

  nodes
    .selectAll("circle")
    .classed(
      "highlight",
      (d) => searchTerm && d.data.name.toLowerCase().includes(searchTerm)
    )
    .classed(
      "dimmed",
      (d) => searchTerm && !d.data.name.toLowerCase().includes(searchTerm)
    );

  nodes
    .selectAll("text")
    .style("font-weight", (d) =>
      searchTerm && d.data.name.toLowerCase().includes(searchTerm)
        ? "bold"
        : "normal"
    );
}

document.getElementById("searchInput").addEventListener("input", function () {
  updateSearch(this.value.toLowerCase());
});

function createLegend() {
  const legend = d3.select("#legend");
  Object.keys(categoryColors).forEach((category) => {
    legend
      .append("div")
      .attr("class", "legend-item")
      .html(
        `<div class="legend-color" style="background:${categoryColors[category]}"></div> ${category}`
      );
  });
}
