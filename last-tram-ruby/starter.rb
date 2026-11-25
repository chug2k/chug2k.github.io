# The printed route and trip order comes from timetables.json.
class TramTimetable
  include Enumerable

  def initialize(routes)
    @routes = routes
  end

  def each
    # This first attempt yields a whole route. Change the unit to one stop.
    # Also support timetable.each with no block, so callers can use next.
    @routes.each do |route|
      yield route
    end
    self
  end
end
