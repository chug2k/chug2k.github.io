require "json"

case ARGV
when []
  require_relative "starter"
when ["--answer"]
  require_relative "answer"
else
  abort "Usage: ruby check.rb [--answer]"
end

def equal(expected, actual)
  raise "expected #{expected.inspect}, got #{actual.inspect}" unless expected == actual
end

def check(label)
  yield
  puts "PASS  #{label}"
  true
rescue StandardError => error
  puts "FAIL  #{label}\n      #{error.class}: #{error.message}"
  false
end

schedules = JSON.parse(File.read(File.join(__dir__, "timetables.json")))
routes = schedules.fetch("night").fetch("routes")
night = TramTimetable.new(routes)
diversion = TramTimetable.new(schedules.fetch("diversion").fetch("routes"))
results = []

results << check("each yields all five stop records in printed order") do
  seen = []
  returned = night.each { |stop| seen << [stop.fetch("name"), stop.fetch("time")] }
  equal([["Moss", "22:16"], ["Bell", "22:22"], ["Pier", "22:40"],
         ["Bell", "22:05"], ["Observatory", "22:12"]], seen)
  raise "each with a block should return the timetable" unless returned.equal?(night)
end

results << check("map collects one name per visit, including both visits to Bell") do
  equal(%w[Moss Bell Pier Bell Observatory], night.map { |stop| stop.fetch("name") })
end

results << check("select keeps the original transfer-stop records") do
  selected = night.select { |stop| stop.fetch("transfer") }
  equal(["22:22", "22:05"], selected.map { |stop| stop.fetch("time") })
  first_bell = routes[0].fetch("trips")[0].fetch("stops")[1]
  second_bell = routes[1].fetch("trips")[0].fetch("stops")[0]
  raise "return the original stop records" unless selected[0].equal?(first_bell) && selected[1].equal?(second_bell)
end

results << check("each without a block returns an Enumerator that can advance, end, and rewind") do
  cursor = night.each
  equal(Enumerator, cursor.class)
  names = 5.times.map { cursor.next.fetch("name") }
  equal(%w[Moss Bell Pier Bell Observatory], names)
  begin
    cursor.next
    raise "expected StopIteration after the last stop"
  rescue StopIteration
    cursor.rewind
  end
  equal("Moss", cursor.next.fetch("name"))
end

results << check("the diversion skips the empty trip and follows its own route order") do
  equal(%w[Tower Market Quay], diversion.map { |stop| stop.fetch("name") })
  equal(["Market"], diversion.select { |stop| stop.fetch("transfer") }.map { |stop| stop.fetch("name") })
end

results << check("a timetable with no routes and a route with no trips both yield zero stops") do
  [[], [{"name" => "Yard", "trips" => []}]].each do |sample|
    empty = TramTimetable.new(sample)
    equal([], empty.to_a)
    equal([], empty.each.to_a)
  end
end

puts "\n#{results.count(true)}/#{results.length} checks passed."
exit(results.all? ? 0 : 1)
