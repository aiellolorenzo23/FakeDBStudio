import type { FakeDb } from '../model/fakeDb'

export const mockDb: FakeDb = {
  version: '1.0.0',
  schemas: {
    main: {
      students: [
        {
          id: 1,
          name: 'Mario',
          surname: 'Rossi',
          active: true,
          course: 'Boogie Woogie'
        },
        {
          id: 2,
          name: 'Luigi',
          surname: 'Verdi',
          active: false,
          course: 'Lindy Hop'
        }
      ],
      teachers: [
        {
          id: 1,
          name: 'Giulia',
          subject: 'Boogie Woogie',
          active: true
        }
      ],
      lessons: []
    },
    test: {
      users: [
        {
          id: 1,
          username: 'admin',
          role: 'ADMIN'
        },
        {
          id: 2,
          username: 'guest',
          role: 'READ_ONLY'
        }
      ]
    }
  }
}
