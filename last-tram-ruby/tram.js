"use strict";

const byId = (id) => document.getElementById(id);

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function stopInspect(stop) {
  return '{"name"=>' + JSON.stringify(stop.name) + ', "time"=>' + JSON.stringify(stop.time) +
    ', "transfer"=>' + String(stop.transfer) + "}";
}

function start(timetables) {
  const service = byId("service");
  const mode = byId("mode");
  const input = byId("prediction");
  const grade = byId("grade");
  const other = byId("other-service");
  const advance = byId("advance");
  const rewind = byId("rewind");
  let visits = [];
  let position = 0;
  let ended = false;

  function showTimetable(announce = false) {
    const timetable = timetables[service.value];
    visits = [];
    const routes = byId("routes");
    routes.replaceChildren();
    for (const route of timetable.routes) {
      const section = element("section", "route");
      section.dataset.line = route.name;
      section.append(element("h3", "", route.name + " line"));
      for (const trip of route.trips) {
        const row = element("div", "trip");
        row.append(element("strong", "trip-no", trip.number));
        if (trip.stops.length === 0) {
          row.append(element("span", "empty", "No scheduled stops"));
        } else {
          const list = element("ol", "stops");
          list.setAttribute("aria-label", "Stops on trip " + trip.number);
          for (const stop of trip.stops) {
            const item = element("li", "stop");
            const name = element("strong", "", stop.name);
            if (stop.transfer) {
              const symbol = element("span", "", " ⇄");
              symbol.setAttribute("aria-hidden", "true");
              name.append(symbol, element("span", "sr", ", transfer stop"));
            }
            const time = element("time", "", stop.time);
            time.dateTime = stop.time;
            item.append(name, time);
            list.append(item);
            visits.push({route: route.name, trip: trip.number, stop, item});
          }
          row.append(list);
        }
        section.append(row);
      }
      routes.append(section);
    }
    input.value = "";
    input.removeAttribute("aria-invalid");
    grade.textContent = "";
    grade.className = "feedback";
    other.hidden = true;
    resetTrace(announce);
  }

  function gradePrediction(event) {
    event.preventDefault();
    const names = input.value.split(/[,\n]/).map((name) => name.trim()).filter(Boolean);
    const normal = (name) => name.toLowerCase();
    const firstMismatch = names.findIndex((name, index) =>
      index >= visits.length || normal(name) !== normal(visits[index].stop.name));
    const correct = firstMismatch === -1 && names.length === visits.length;
    grade.classList.toggle("good", correct);
    input.setAttribute("aria-invalid", String(!correct));
    other.hidden = !correct;
    if (correct) {
      const hasEmptyTrip = timetables[service.value].routes.some((route) =>
        route.trips.some((trip) => trip.stops.length === 0));
      grade.textContent = hasEmptyTrip ?
        "That’s the printed order. H8 has no stops to yield. H9 finishes before the traversal moves to Canal." :
        "That’s the printed order. Both visits to Bell count. Its 22:05 visit appears after Pier because Hill is the second route.";
      return;
    }
    if (names.length === 0) {
      grade.textContent = "Enter the first stop name, then the rest of the visits in print order.";
      input.focus();
      return;
    }
    const index = firstMismatch === -1 ? names.length : firstMismatch;
    if (index === visits.length) {
      grade.textContent = "All " + visits.length + " visits match. Remove the extra name after the final trip.";
      return;
    }
    const next = visits[index];
    const prefix = index === 0 ? "Start" : "Your first " + index + (index === 1 ? " visit matches. Look" : " visits match. Look");
    grade.textContent = prefix + " on the " + next.route + " line, trip " + next.trip +
      ", for visit " + (index + 1) + ". Follow the printed order, including repeated names.";
  }

  const calls = {
    next: "cursor = timetable.each\ncursor.next",
    map: 'timetable.map { |stop| stop.fetch("name") }',
    select: 'timetable.select { |stop| stop.fetch("transfer") }'
  };

  function resetTrace(announce = true) {
    position = 0;
    ended = false;
    renderTrace(announce);
  }

  function renderTrace(announce = true) {
    const method = mode.value;
    const current = position > 0 && !ended ? visits[position - 1] : null;
    const complete = position === visits.length;
    const stop = current?.stop;
    visits.forEach((visit) => {
      if (visit === current) visit.item.setAttribute("aria-current", "step");
      else visit.item.removeAttribute("aria-current");
    });
    byId("call-code").textContent = calls[method];
    let title;
    let detail;
    let label = "";
    let value = "";
    if (ended) {
      title = "The cursor reached the end.";
      detail = "The previous call returned the final stop. This extra call to next raises StopIteration. Rewind to visit the first stop again.";
      label = "Ruby raises";
      value = "StopIteration";
    } else if (position === 0) {
      if (method === "next") {
        title = "An Enumerator is ready.";
        detail = "Calling each without a block returns a cursor. Ask for next to receive the first stop.";
      } else if (method === "map") {
        title = "Collect each stop’s name.";
        detail = "Each yield gives the block a stop record. Follow the names as map builds the array it will return.";
      } else {
        title = "Keep the transfer stops.";
        detail = "Each yield gives the block a stop record. When its transfer flag is true, select keeps that whole record.";
      }
    } else {
      title = stop.name + " at " + stop.time;
      if (method === "next") {
        detail = "The cursor returned the original stop record from " + current.trip +
          (complete ? ". There are no more stops in this timetable." : " and paused until the next call.");
        label = "Return value of cursor.next";
        value = stopInspect(stop);
      } else if (method === "map") {
        detail = "The block read the name and returned " + JSON.stringify(stop.name) + ". map appends that string.";
        label = complete ? "Final array returned by map" : "Names collected so far";
        value = "[" + visits.slice(0, position).map((visit) => JSON.stringify(visit.stop.name)).join(", ") + "]";
      } else {
        detail = stop.transfer ? "The block returned true. select kept this stop record with its time and transfer flag." :
          "The block returned false. select skipped this stop record.";
        label = complete ? "Final array returned by select" : "Stop records kept so far";
        value = "[" + visits.slice(0, position).filter((visit) => visit.stop.transfer)
          .map((visit) => stopInspect(visit.stop)).join(",\n ") + "]";
      }
    }
    const serviceName = timetables[service.value].title;
    const location = current ? " · " + current.route + " / " + current.trip : "";
    byId("trace-step").textContent = serviceName + " · " + position + " of " + visits.length + " yielded" + location;
    byId("trace-title-now").textContent = title;
    byId("trace-detail").textContent = detail;
    byId("trace-value").hidden = !label;
    byId("value-label").textContent = label;
    byId("value").textContent = value;
    const active = document.activeElement;
    advance.textContent = method === "next" ? (complete && !ended ? "Call next again →" : "Call next →") : "Yield a stop →";
    advance.disabled = ended || (method !== "next" && complete);
    rewind.disabled = position === 0 && !ended;
    if (advance.disabled && active === advance) rewind.focus();
    if (rewind.disabled && active === rewind) advance.focus();
    if (announce) byId("trace-status").textContent = byId("trace-step").textContent + ". " + title + ". " + detail + " " + value;
  }

  byId("prediction-form").addEventListener("submit", gradePrediction);
  input.addEventListener("input", () => {
    input.removeAttribute("aria-invalid");
    grade.textContent = "";
    other.hidden = true;
  });
  service.addEventListener("change", () => showTimetable(true));
  other.addEventListener("click", () => {
    service.value = service.value === "night" ? "diversion" : "night";
    showTimetable(true);
    service.focus();
  });
  mode.addEventListener("change", () => resetTrace());
  rewind.addEventListener("click", () => resetTrace());
  advance.addEventListener("click", () => {
    if (position < visits.length) position += 1;
    else ended = true;
    renderTrace();
  });
  service.disabled = false;
  byId("prediction-form").hidden = false;
  byId("trace-panel").hidden = false;
  showTimetable();
}

async function loadTimetables() {
  const loading = byId("loading");
  loading.hidden = false;
  loading.textContent = "Loading the timetables…";
  try {
    const result = await fetch("timetables.json");
    if (!result.ok) throw new Error("Timetables unavailable");
    start(await result.json());
    loading.hidden = true;
  } catch {
    const retry = element("button", "text-button", "Try again");
    retry.type = "button";
    retry.addEventListener("click", loadTimetables);
    const kit = element("a", "", "Download the Ruby kit");
    kit.href = "last-tram-ruby.zip";
    loading.replaceChildren("The timetables could not be loaded. ", retry, " or ", kit, ".");
  }
}

loadTimetables();
