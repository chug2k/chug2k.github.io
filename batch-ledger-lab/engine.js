"use strict";

const BatchCost = (() => {
  const cases = {
    candles: {name: "Candle run", item: "candles", initial: [20, 3800, 100, 200, 10],
      brief: "Twenty candles are ready to pack. The wax left on the pourer and the fragrance spilled on the bench still came out of the lots.",
      lots: [
        {name: "Wax", unit: "g", quantity: 10000, cents: 6000},
        {name: "Fragrance", unit: "g", quantity: 1000, cents: 8000}
      ]},
    notebooks: {name: "Notebook run", item: "notebooks", initial: [24, 288, 12, 24, 1],
      brief: "A bindery finished 24 notebooks. Twelve misprinted sheets and one torn cover went into the recycling bin. Predict the batch cost before you preview it.",
      lots: [
        {name: "Paper", unit: "sheets", quantity: 900, cents: 8100},
        {name: "Cover stock", unit: "covers", quantity: 120, cents: 3000}
      ]}
  };
  function calculate(scenario, inputs) {
    if (!Array.isArray(inputs) || inputs.length !== 5 || inputs.some(n => !Number.isSafeInteger(n) || n < 0 || n > 100000))
      throw Error("Use a whole number from 0 to 100,000 in every box.");
    const [output, ...materials] = inputs;
    if (output < 1) throw Error("Enter at least one finished unit.");
    const lines = scenario.lots.map((lot, i) => {
      const goods = materials[i * 2], scrap = materials[i * 2 + 1];
      const used = goods + scrap;
      if (used > lot.quantity) throw Error(lot.name + " needs " + used.toLocaleString("en-US") + " " + lot.unit + ". The opening lot has " + lot.quantity.toLocaleString("en-US") + ".");
      return {goods, scrap, used, cents: Math.round(lot.cents * used / lot.quantity)};
    });
    if (!lines.some(line => line.goods > 0)) throw Error("Put some material into the finished goods.");
    const total = lines.reduce((sum, line) => sum + line.cents, 0);
    return {output, lines, total};
  }
  function active(log) {
    const last = log[log.length - 1];
    return last?.type === "posted" ? last : null;
  }
  function post(scenario, log, inputs) {
    if (active(log)) throw Error("Reverse the posted batch before pricing another.");
    const run = log.filter(entry => entry.type === "posted").length + 1;
    return [...log, {type:"posted", run, batch:calculate(scenario,inputs)}];
  }
  function reverse(log) {
    const entry = active(log);
    if (!entry) throw Error("There is no posted batch to reverse.");
    return [...log, {type:"reversed", run:entry.run, batch:entry.batch}];
  }
  function balance(scenario, log) {
    const current=active(log);
    return scenario.lots.map((lot,i) => ({
      quantity:lot.quantity - (current?.batch.lines[i].used ?? 0),
      cents:lot.cents - (current?.batch.lines[i].cents ?? 0)
    }));
  }
  function csv(scenario, log) {
    const header = ["Run","Entry","Material","Unit","Finished units","In goods","Scrap","Stock change","Cost change (cents)","Qty on hand","Cents on hand"];
    const rows = [header];
    const balances = scenario.lots.map(lot => ({quantity:lot.quantity,cents:lot.cents}));
    log.forEach(entry => {
      const sign = entry.type === "posted" ? -1 : 1;
      scenario.lots.forEach((lot,i) => {
        const part=entry.batch.lines[i], item=balances[i];
        item.quantity+=sign*part.used; item.cents+=sign*part.cents;
        rows.push([entry.run,entry.type,lot.name,lot.unit,entry.batch.output,part.goods,part.scrap,sign*part.used,sign*part.cents,item.quantity,item.cents]);
      });
    });
    return rows.map(row=>row.join(",")).join("\r\n")+"\r\n";
  }
  return {cases,calculate,active,post,reverse,balance,csv};
})();
if (typeof module !== "undefined" && module.exports) module.exports = BatchCost;
