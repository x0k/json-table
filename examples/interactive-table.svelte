<script lang="ts">
  import { SvelteSet } from "svelte/reactivity";
  import {
    isJsonPrimitive,
    type JSONObject,
    type JSONValue,
  } from "@json-table/core/lib/json";
  import {
    makeTreeFactory,
    joinPrimitiveArrayValues,
    rows,
		makeProportionalResizeGuard,
  } from "@json-table/core";

  const collapsed = new SvelteSet<Collapsible>();

  class Collapsible {
    label = "";
    readonly value: unknown;
    readonly summary: string;

    constructor(value: JSONObject) {
      const isArray = Array.isArray(value);
      this.value = isArray
        ? value.map(Collapsible.wrap)
        : Object.fromEntries(
            Object.entries(value).map(([key, value]) => [
              key,
              Collapsible.wrap(value),
            ]),
          );
      this.summary = `${isArray ? value.length : Object.keys(value).length} ${isArray ? "items" : "keys"}`;
    }

    private static wrap(value: JSONValue): JSONValue | Collapsible {
      return isJsonPrimitive(value) ||
        (Array.isArray(value) && value.every(isJsonPrimitive))
        ? value
        : new Collapsible(value);
    }

    toJSON() {
      return collapsed.has(this) ? this.summary : this.value;
    }
  }

  const createTree = makeTreeFactory({
    cornerCellValue: "№",
    joinArrayValues: joinPrimitiveArrayValues,
		isProportionalResize: makeProportionalResizeGuard(10),
    createHeader(key, record) {
      const value = record[key];
      if (value instanceof Collapsible) {
        value.label = key;
        return value;
      }
      return key;
    },
    createIndex: (i) => `${i + 1}`,
  });

  const data = {
    company: "TechCorp",
    yearFounded: 2000,
    founders: ["Alice", "Bob"],
    headquarters: {
      city: "Silicon Valley",
      country: "USA",
    },
    departments: [
      {
        name: "Research",
        employees: [
          {
            name: "Charlie",
            position: "Research Scientist",
          },
          {
            name: "Diana",
            position: "Research Analyst",
          },
        ],
      },
      {
        name: "Development",
        employees: [
          {
            name: "Eva",
            position: "Software Engineer",
          },
          {
            name: "Frank",
            position: "UI/UX Designer",
          },
        ],
      },
      {
        name: "Marketing",
        employees: [
          {
            name: "Grace",
            position: "Marketing Manager",
          },
          {
            name: "Harry",
            position: "Social Media Specialist",
          },
        ],
      },
    ],
    projects: [
      {
        title: "Project A",
        team: ["Alice", "Charlie", "Eva"],
        progress: 75,
      },
      {
        title: "Project B",
        team: ["Bob", "Diana", "Frank"],
        progress: 60,
      },
      {
        title: "Project C",
        team: ["Charlie", "Eva", "Grace"],
        progress: 90,
      },
    ],
  };

  const tableData = new Collapsible(data);
</script>

<table>
  <tbody>
    {#each rows(createTree(tableData)) as row}
      <tr>
        {#each row as cell}
          <td colspan={cell.width} rowspan={cell.height}>
            {#if cell.node.type === "header" && cell.node.value instanceof Collapsible}
              {@const collapsible = cell.node.value}
              {@const isCollapsed = collapsed.has(collapsible)}
              <div class="header">
                {collapsible.label}
                <button
                  onclick={() => {
                    if (isCollapsed) {
                      collapsed.delete(collapsible);
                    } else {
                      collapsed.add(collapsible);
                    }
                  }}
                >
                  {#if isCollapsed}
                    +
                  {:else}
                    -
                  {/if}
                </button>
              </div>
            {:else if cell.node.type !== "leaf"}
              <b>{cell.node.value}</b>
            {:else}
              {cell.node.value}
            {/if}
          </td>
        {/each}
      </tr>
    {/each}
  </tbody>
</table>

<style>
  .header {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    font-weight: bold;
  }
  table,
  td {
    border: 1px solid black;
    border-collapse: collapse;
  }
  td {
    padding: 5px;
    text-align: left;
  }
  td:has(> b) {
    text-align: center;
  }
</style>
