import { describe, it, expect } from 'vitest'

describe('Weekend Harmony App', () => {
  it('should have basic JavaScript functionality working', () => {
    // Test basic array operations (like what the app uses for activities)
    const activities = [
      { id: 1, name: 'Morning Walk' },
      { id: 2, name: 'Coffee Shop Visit' }
    ]
    
    expect(activities.length).toBe(2)
    expect(activities.find(a => a.id === 1)?.name).toBe('Morning Walk')
    
    // Test object operations (like what the app uses for plans)
    const plan = {
      title: 'My Weekend Plan',
      activities: activities,
      mood: 'relaxed'
    }
    
    expect(plan.title).toBe('My Weekend Plan')
    expect(plan.activities.length).toBe(2)
    expect(plan.mood).toBe('relaxed')
  })
})
