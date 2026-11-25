class TramTimetable
  include Enumerable

  def initialize(routes)
    @routes = routes
  end

  def each
    return enum_for(:each) unless block_given?

    @routes.each do |route|
      route.fetch("trips").each do |trip|
        trip.fetch("stops").each do |stop|
          yield stop
        end
      end
    end
    self
  end
end
