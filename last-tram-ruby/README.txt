The Last Tram
A Ruby exercise for Charles Lee’s lesson shelf · November 2026

The pocket timetable lists routes. Each route has trips, and each trip has
zero or more stops. A printed stop records its name, time, and transfer flag.
The two fictional timetables in timetables.json are also used in the browser.

Unzip the kit, open a terminal in the last-tram-ruby folder, then run:

    ruby check.rb

The starter deliberately yields entire routes. The failing checks show
which part of the contract still needs work. Edit starter.rb so that:

1. With a block, each visits every stop in the listed route, trip, and stop
   order. Yield each original stop record, including repeated names. An empty
   trip contributes zero stops. Return the timetable after the traversal.
2. Without a block, each returns an Enumerator. A caller can then ask for the
   next stop. A further next after the last one raises StopIteration.
3. Let the included Enumerable module supply map and select from this each.

Run ruby check.rb again. To run the same independent checks against the
worked implementation in answer.rb, use:

    ruby check.rb --answer

Only Ruby and its standard JSON library are needed. To print a prediction
yourself, save these lines as ride.rb in this folder and run ruby ride.rb.

    require "json"
    require_relative "starter"
    data = JSON.parse(File.read(File.join(__dir__, "timetables.json")))
    timetable = TramTimetable.new(data.fetch("night").fetch("routes"))
    p timetable.map { |stop| stop.fetch("name") }
    p timetable.select { |stop| stop.fetch("transfer") }
    cursor = timetable.each
    p cursor.next
    p cursor.next

Change "night" to "diversion" to use the other timetable.

New exercise, scenarios, and implementation developed for Charles Lee’s
workshop with Codex. The historical reference is CoderSchool’s first Advanced
Ruby assignment. Its 11 July 2016 commit is credited to Harley Trung.

Browser lesson      https://clpanic.com/last-tram-ruby/
Enumerable          https://docs.ruby-lang.org/en/4.0/Enumerable.html
Enumerator          https://docs.ruby-lang.org/en/4.0/Enumerator.html
Object#enum_for     https://docs.ruby-lang.org/en/4.0/Object.html#method-i-enum_for
2016 assignment     https://github.com/coderschool/advanced_ruby_assignment_1/commit/2fb416b6dd8720b2926731f2da4092e8e5a47bb3
