---
name: jsonnav
description: Navigate large structured JSON files efficiently using the jsonnav CLI and its generated indexes.
---

# jsonnav

## Purpose

`jsonnav` is a local CLI tool used to navigate large structured JSON files without loading or scanning the entire file into the AI context.

It provides a compact index of the JSON structure and allows retrieving only the data that is needed.

Use it whenever a project contains a `jsonnav.config.yaml` configuration file.

---

## When to use jsonnav

Before directly opening, reading, searching or parsing a large JSON file, check whether the project uses jsonnav.

A project using jsonnav contains a file named:

`jsonnav.config.yaml`

The file is not necessarily located at the project root.

Search the project for `jsonnav.config.yaml` when you need to work with structured JSON data.

Do not assume a fixed location.

---

## Finding the configuration

When working with a large JSON dataset:

1. Search the project for `jsonnav.config.yaml`.
2. Determine which source defined in the configuration contains the data you need.
3. Use jsonnav to inspect the source before opening the JSON directly.

If multiple `jsonnav.config.yaml` files exist, determine which one belongs to the data or project area being worked on.

Do not assume the first result is necessarily the correct one.

---

## CLI usage

All jsonnav commands require the `--config` option.

The configuration path must point to the project's `jsonnav.config.yaml`.

Examples:

    jsonnav --config ./jsonnav.config.yaml list
    jsonnav --config ./jsonnav.config.yaml sections documentation
    jsonnav --config ./jsonnav.config.yaml structure documentation 42
    jsonnav --config ./jsonnav.config.yaml ref documentation 42 configuration.serveur
    jsonnav --config ./jsonnav.config.yaml get documentation 42 texte

If the configuration is located elsewhere, use its actual path:

    jsonnav --config ./path/to/jsonnav.config.yaml list

Never assume that `jsonnav.config.yaml` is located next to the jsonnav executable.

---

## Recommended workflow

When working with data contained in a jsonnav-managed JSON file, follow this order.

### 1. Find the configuration

Search the project for:

`jsonnav.config.yaml`

The configuration file may be located anywhere inside the project.

### 2. List available sources

Run:

    jsonnav --config <config> list

This identifies the logical JSON sources available through jsonnav.

### 3. Find the relevant section

Use:

    jsonnav --config <config> sections <source>

This returns the identifiers of the sections available in the source.

### 4. Inspect the structure

Before retrieving a large amount of data, use:

    jsonnav --config <config> structure <source> <section>

This shows the structure of the section without retrieving its actual values.

Use this to understand which properties are available.

### 5. Retrieve only the required data

Use:

    jsonnav --config <config> get <source> <section> <property>

Examples:

    jsonnav --config <config> get documentation 42 texte

    jsonnav --config <config> get documentation 42 configuration

    jsonnav --config <config> get documentation 42 configuration.serveur

Prefer retrieving the smallest amount of data necessary for the current task.

---

## Using ref

Use:

    jsonnav --config <config> ref <source> <section> <property>

when a JSON Pointer/reference to the original data is useful.

Example:

    jsonnav --config <config> ref documentation 42 configuration.serveur

This can be useful when the exact location of a property in the original JSON needs to be known.

---

## Important rules

### Do not read the entire JSON unnecessarily

Do not directly open a large JSON file if the required information can be obtained through jsonnav.

Avoid loading the entire JSON into the context simply to locate one section.

Use the jsonnav index first.

### Understand structure before retrieving large data

When the structure is unknown, use:

    jsonnav --config <config> structure <source> <section>

before using `get`.

This is particularly important when a property such as `texte` contains a large amount of content.

### Retrieve only what is needed

Prefer:

    jsonnav --config <config> get documentation 42 configuration.serveur

over:

    jsonnav --config <config> get documentation 42 configuration

when only `configuration.serveur` is required.

### Do not modify the index manually

The `jsonnav.*.index.json` files are generated files.

Do not manually edit them.

If the source JSON changes and the index needs updating, use the jsonnav indexing functionality rather than editing the index directly.

### jsonnav is navigation tooling

Use jsonnav to locate and retrieve information.

When modifying the original JSON, modify the actual source JSON rather than the generated index.

After modifying the source JSON, ensure the corresponding jsonnav index is regenerated if required.

---

## Choosing between commands

Use `list` when you do not know which JSON sources are available.

Use `sections` when you know the source but need to find or identify sections.

Use `structure` when you need to understand what properties exist in a section.

Use `get` when you need the actual value of a property.

Use `ref` when you need the JSON Pointer/reference to a property.

---

## Example workflow

Suppose the task is:

"Understand section 42 of the documentation and update its server configuration."

First locate the configuration by searching the project for:

`jsonnav.config.yaml`

Then:

    jsonnav --config <config> list

Identify the relevant source, for example `documentation`.

Inspect section 42:

    jsonnav --config <config> structure documentation 42

Retrieve only the relevant configuration:

    jsonnav --config <config> get documentation 42 configuration

Use the returned information to understand the existing structure and data.

Then modify the original JSON source.

Do not modify the generated index directly.

---

## Working with large properties

Some properties, especially `texte`, may contain very large amounts of text.

Do not retrieve large properties unless they are actually needed for the current task.

If the task only requires understanding the structure of a section, use `structure` instead of `get`.

If the task requires only one nested property, retrieve that property directly.

For example, prefer:

    jsonnav --config <config> get documentation 42 configuration.serveur

instead of retrieving the entire `configuration` object.

---

## Working with multiple JSON sources

A single `jsonnav.config.yaml` may define multiple sources.

Do not assume that the source name corresponds to the JSON filename.

Always use:

    jsonnav --config <config> list

to discover the available source names.

Then use the appropriate source name with `sections`, `structure`, `ref` or `get`.

---

## Summary

When a project contains `jsonnav.config.yaml`, treat jsonnav as the preferred navigation interface for the associated large JSON files.

The general workflow is:

Find `jsonnav.config.yaml`
→ `jsonnav list`
→ identify the source
→ `jsonnav sections <source>`
→ identify the section
→ `jsonnav structure <source> <section>`
→ understand the structure
→ `jsonnav get <source> <section> <property>`
→ work with the required data

The goal is to avoid unnecessarily loading large JSON documents into the AI context.